import { wikifetch, wikifetchTexts } from './fetchFunctions';
import { normalizeString, getTextSections } from './textFunctions';
import lcmodule from './authors.mjs';

class User {
    name;
    index;
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
                    let lcs = this.wasm.LCSubstr(t, s.substring);
                    if (lcs.length > minLcsLength) {
                        substrings.push({Section: s, Text: t, LCS: lcs});
                    }
                }
            }
            for (let t of newTexts) {
                for (let s of this.sections.filter(s => !s.revKnown && !newSections.includes(s))) {
                    // let lcs = this.LCSubstr(t, s.substring);
                    let lcs = this.wasm.LCSubstr(t, s.substring);
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
    isEmpty(str) {
        return str.length === 0 || str.trim().length === 0;
    }
}

let wasmModule;

self.onmessage = async (e) => {
    const { title, revisions, targetRevIndex, targetRevision } = e.data;
    let users = [];
    let wasmReady = false;
    let articleText = null;

    if (!wasmModule || !wasmReady) {
        wasmModule = await lcmodule();
        wasmReady = true;
    }

    const getUsers = () => {
        users = [];
        let ind = 0;
        for (let rev of revisions) {
            if (rev.user == null) continue;
            let u1 = users.find(u => u.name === rev.user);
            if (!u1) {
                u1 = new User();
                u1.name = rev.user;
                u1.index = ind;
                ind++;
                if (rev.anon) {
                    u1.anon = true;
                }
                u1.nrOfEdits = 1;
                u1.nrOfMinorEdits = rev.minor ? 1 : 0;
                users.push(u1);
            } else {
                u1.nrOfEdits++;
                if (rev.minor) u1.nrOfMinorEdits++;
            }
        }
    };
    getUsers();
    const targetText = await wikifetch(title, targetRevision.id);
    articleText = new ArticleText(targetText, wasmModule);

    let rev;
    let step = Math.round(targetRevIndex / 10);
    for (let i = 0; i <= targetRevIndex; i++) {
        if (i % 50 == 0) {
            const rev50Texts = await wikifetchTexts(title, revisions[i].id, 50);
            for (let r = 0; r < rev50Texts.length; r++) {
                if ((i + r < targetRevIndex) && revisions[i + r].user == revisions[i + r + 1].user) {
                    continue;
                }
                revisions[i + r].fullText = rev50Texts[r];
            }
        }
        if (i % step == 0)
            self.postMessage({type: 'progress', value: Math.round(i * 100 / targetRevIndex)});
        if ((i < targetRevIndex) && (revisions[i].user == revisions[i + 1].user)) {
            continue;
        }
        rev = revisions[i];
        if (!rev.fullText || rev.fullText.length === 0) continue;
        articleText.MarkNewSections(rev);
        rev.fullText = null;
    }
    articleText.ready = true;

    const getContribution = () => {
        let totalLength = 0;
        for (let s of articleText.sections) {
            if (s.revKnown) totalLength += s.Length;
        }
        for (let u of users) {
            u.lengthOfContentAdded = 0;
            for (let s of articleText.sections) {
                if ((s.revKnown) && (s.rev.user == u.name)) {
                    u.lengthOfContentAdded += s.Length;
                }
            }
            if (articleText.text.length > 0) {
                u.percentageOfContentAdded = Math.round(100 * u.lengthOfContentAdded / totalLength);
            }
        }
        articleText.finished = true;
    }
    getContribution();

    if (articleText.finished) {
        self.postMessage({type: 'done', users});
    }
}
