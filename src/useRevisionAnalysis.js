import { useEffect, useRef, useState } from "react"
import { normalizeString, getTextSections } from "./textFunctions";
import { wikifetch, wikifetchTexts } from "./fetchFunctions";
import lcmodule from "./authors.mjs";

class User {
    name;
    anon = false;
    nrOfEdits = 0;
    nrOfMinorEdits = 0;
    lengthOfContentAdded = -1;
    percentageOfContentAdded = -1;
}

class Section {
    Start;
    Length;
    rev;
    revKnown;
    substring;
    constructor(start, length, s, rev=null, revKnown=false) {
        this.Start = start;
        this.Length = length;
        this.rev = rev;
        this.revKnown = revKnown;
        this.substring = s.substring(start, start + length);
    }
}

class ArticleText {
    text;
    normalizedText;
    sections;
    ready = false;
    finished = false;
    wasm;
    constructor(text, wasm) {
        this.wasm = wasm;
        this.text = text;
        this.normalizedText = normalizeString(text);
        this.sections = getTextSections(` ${text} `, /(?<text>[\s\S]*?)(?:$|\r?\n\r?\n|\. )/g, (pos, len) => {return new Section(pos, len, this.normalizedText)});
    }
    MarkNewSections(rev) {
        let texts = getTextSections(rev.fullText, /(?<text>[\s\S]*?)(?:$|\r?\n\r?\n|\. )/g, (pos, len) => rev.fullText.substring(pos, pos + len)).map(t => normalizeString(t));
        
        for (let s of this.sections) {
            if (s.revKnown) {
                let sectionText = " " + s.substring + " ";
                for (let i = 0; i < texts.length; i++) {
                    let t = texts[i];
                    let pos = t.indexOf(sectionText);
                    if (pos > -1) {
                        let firstText = t.substring(0, pos).trim();
                        let lastText = t.substring(pos + s.Length).trim();
                        texts.splice(i, 1);

                        if (firstText !== "") texts.push(" " + firstText + " ");
                        if (lastText !== "") texts.push(" " + lastText + " ");
                        break;
                    }
                }
            }
        }
        let substrings = [];

        let newSections = this.sections.filter(s => !s.revKnown);
        let newTexts = [];

        const minLcsLength = 3;
        while (true) {
            for (let t of texts) {
                for (let s of newSections) {
                    // let lcs = this.LCSubstr(t, s.substring);
                    let lcs = this.wasm.current.LCSubstr(t, s.substring);
                    if (lcs.length > minLcsLength) {
                        substrings.push({Section: s, Text: t, LCS: lcs});
                    }
                }
            }
            for (let t of newTexts) {
                for (let s of this.sections.filter(s => !s.revKnown && !newSections.includes(s))) {
                    // let lcs = this.LCSubstr(t, s.substring);
                    let lcs = this.wasm.current.LCSubstr(t, s.substring);
                    if (lcs.length > minLcsLength) {
                        substrings.push({Section: s, Text: t, LCS: lcs});
                    }
                }
            }
            newTexts = [];
            newSections = [];

            if (substrings.length === 0) return;
            let max = substrings.reduce((x, y) => (x.LCS.length > y.LCS.length ? x : y));

            let text = max.Text;
            let section = max.Section;
            let index = max.LCS.index1;
            let length = max.LCS.length;
            let pos = max.LCS.index2;

            let firstText = " " + text.substring(0, index) + " ";
            let lastText = " " + text.substring(index + length) + " ";

            const ind = texts.indexOf(text);
            if (ind !== -1) texts.splice(ind, 1);

            let firstSection = new Section(section.Start, pos + 1, this.normalizedText);
            let lastSection = new Section(section.Start + pos + length - 1, section.Length - pos - length + 1, this.normalizedText);
            let middleSection = new Section(section.Start + pos + 1, length - 2, this.normalizedText, rev, true);

            const ind2 = this.sections.indexOf(section);
            if (ind2 !== -1) this.sections.splice(ind2, 1);

            let newS = [firstSection, lastSection].filter(s => !this.isEmpty(s.substring));
            let newT = [firstText, lastText].filter(t => !this.isEmpty(t));

            texts.push(...newT);
            newTexts.push(...newT);
            this.sections.push(...newS);
            newSections.push(...newS);

            substrings = substrings.filter(x => x.Text !== text && x.Section !== section);

            if (middleSection.substring.trim() !== "") {
                this.sections.push(middleSection);
            }
        }
    }
    // LCSubstr(s1, s2) {
    //     let L = [
    //         new Array(s2.length).fill(0),
    //         new Array(s2.length).fill(0)
    //     ];

    //     let z = 0;
    //     let foundIndex = Number.MAX_SAFE_INTEGER;
    //     let foundIndex2 = 0;

    //     for (let i = 0; i < s1.length; i++) {
    //         const iCur = i % 2;
    //         for (let j = 0; j < s2.length; j++) {
    //             let first = i === 0 || j === 0 || L[1 - iCur][j - 1] === 0;

    //             if (s1[i] === s2[j] && (s1[i] === ' ' || !first)) {
    //                 if (i === 0 || j === 0) {
    //                     L[iCur][j] = 1;
    //                 } else {
    //                     L[iCur][j] = L[1 - iCur][j - 1] + 1;
    //                 }

    //                 if (s1[i] === ' ' && L[iCur][j] > z) {
    //                     z = L[iCur][j];
    //                     foundIndex = i;
    //                     foundIndex2 = j;
    //                 }
    //             } else {
    //                 L[iCur][j] = 0;
    //             }
    //         }
    //     }
    //     let index1 = z === 0 ? -1 : foundIndex - z + 1;
    //     let index2 = z === 0 ? -1 : foundIndex2 - z + 1;

    //     return { index1, index2, length: z };
    // }
    isEmpty(str) {
        return str.length === 0 || str.trim().length === 0;
    }
}

export const useRevisionAnalysis = (title, targetRevision, targetIndex, allRevisions, startAnalysis) => {
    const [users, setUsers] = useState(null);
    const [progress, setProgress] = useState(0);
    const usersArrayRef = useRef([]);
    const articleTextRef = useRef(null);
    const wasmRef = useRef(null);
    const [wasmReady, setWasmReady] = useState(false);

    useEffect(() => {
        lcmodule().then((module) => {
            wasmRef.current = module;
            setWasmReady(true);
        });
    }, []);

    useEffect(() => {
        if (!targetRevision || !startAnalysis || !wasmReady) {
            return;
        }
        setUsers(null);
        setProgress(0);
        articleTextRef.current = null;

        const analyze = async () => {
            console.time('time');
            getUsers();

            const targetText = await wikifetch(title, targetRevision.id);
            articleTextRef.current = new ArticleText(targetText, wasmRef);

            let rev;
            for (let i = 0; i <= targetIndex; i++) {
                if (i % 50 == 0) {
                    const rev50Texts = await wikifetchTexts(title, allRevisions[i].id, 50);
                    for (let r = 0; r < rev50Texts.length; r++) {
                        if ((i + r < targetIndex) && allRevisions[i + r].user == allRevisions[i + r + 1].user) {
                            continue;
                        }
                        allRevisions[i + r].fullText = rev50Texts[r];
                    }
                }
                if ((i < targetIndex) && (allRevisions[i].user == allRevisions[i + 1].user)) {
                    continue;
                }
                rev = allRevisions[i];
                if (!rev.fullText || rev.fullText.length === 0) continue;
                articleTextRef.current.MarkNewSections(rev);
                setProgress(i * 100 / targetIndex);
                rev.fullText = null;
            }
            articleTextRef.current.ready = true;
        };
        analyze();
    }, [targetRevision, startAnalysis, targetIndex, wasmReady]);

    const getContribution = () => {
        let totalLength = 0;
        for (let s of articleTextRef.current.sections) {
            if (s.revKnown) totalLength += s.Length;
        }
        for (let u of usersArrayRef.current) {
            u.lengthOfContentAdded = 0;
            for (let s of articleTextRef.current.sections) {
                if ((s.revKnown) && (s.rev.user == u.name)) {
                    u.lengthOfContentAdded += s.Length;
                }
            }
            if (articleTextRef.current.text.length > 0) {
                u.percentageOfContentAdded = (u.lengthOfContentAdded / totalLength);
            }
        }
        let topUsers = [];
        let maxUser;
        for (let i = 0; i < 5; i++) {
            maxUser = null;
            for (let u of usersArrayRef.current) {
                if ((!topUsers.includes(u)) && (u.lengthOfContentAdded > 0) && ((maxUser === null) || (u.lengthOfContentAdded > maxUser.lengthOfContentAdded))) {
                    maxUser = u;
                }
            }
            topUsers.push(maxUser);
        }
        setUsers(usersArrayRef.current);
        console.timeEnd('time');
        articleTextRef.current.finished = true;
    };
    if (articleTextRef.current !== null && articleTextRef.current.ready && !articleTextRef.current.finished) {
        getContribution();
    }

    const getUsers = () => {
        usersArrayRef.current = [];
        for (let rev of allRevisions) {
            if (rev.user == null) continue;
            let u1 = usersArrayRef.current.find(u => u.name === rev.user);

            if (!u1) {
                u1 = new User();
                u1.name = rev.user;

                if (rev.anon) {
                    u1.anon = true;
                }

                u1.nrOfEdits = 1;
                u1.nrOfMinorEdits = rev.minor ? 1 : 0;

                usersArrayRef.current.push(u1);
            } else {
                u1.nrOfEdits++;
                if (rev.minor) u1.nrOfMinorEdits++;
            }
        }
    };

    return { users, progress };
};