const specialChars = ['.', ',', '!', '?', '[', ']', '(', ')', '{', '}', '|', '-', '\'', '"', ':', '=', ';', '#', '/', '\\', '*', '<', '>'];

export const normalizeString = (s) => {
    return ` ${s} `.replace(/[\n\r\t]/g, ' ').split('').map(c => specialChars.includes(c) ? ' ' : c).join('');
};

export const getTextSections = (text, regex, func) => {
    const results = [];
    const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let match;

    while ((match = globalRegex.exec(text)) !== null) {
        const full = match[0];
        const grp = match.groups?.text || match[1]; 

        if (!grp || grp.length === 0) {
            if (globalRegex.lastIndex === match.index) globalRegex.lastIndex++;
            continue;
        }

        const grpIndex = match.index + full.indexOf(grp);

        const len = grpIndex === 0 ? grp.length + 1 : grp.length + 2;
        const len2 = (grpIndex + grp.length === text.length) ? len - 1 : len;

        const start = Math.max(0, grpIndex - 1);
        results.push(func(start, len2));

        if (globalRegex.lastIndex === match.index) globalRegex.lastIndex++;
    }

    return results;
};