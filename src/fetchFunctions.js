let globalCallback;

export const fetchRevInfo = (title, callback, progressCallback) => {
    let allRevisions = [];
    globalCallback = callback;

    const loadChunk = (rvcontinue = null) => {
        const script = document.createElement('script');
        script.id = 'rev-script';
        let url = `https://ru.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvlimit=500&format=json&rvprop=ids|timestamp|flags|user|size&callback=handleRevisionsChunk`;
        if (rvcontinue) {
            url += `&rvcontinue=${encodeURIComponent(rvcontinue)}`;
        }
        script.src = url;
        window.handleRevisionsChunk = (data) => {
            const revisions = data.query?.pages ? 
                Object.values(data.query.pages)[0].revisions || [] : [];

            allRevisions = [...allRevisions, ...revisions.map(rev => ({
                id: rev.revid,
                minor: rev.hasOwnProperty('minor'),
                user: rev.user,
                timestamp: rev.timestamp,
                size: rev.size,
                anon: rev.hasOwnProperty('anon'),
            }))];

            progressCallback(allRevisions.length);

            if (data.continue?.rvcontinue) {
                loadChunk(data.continue.rvcontinue);
            } else {
                globalCallback(allRevisions);
                cleanup();
            }
            document.body.removeChild(script);
        };
        document.body.appendChild(script);
    };
    const cleanup = () => {
        delete window.handleRevisionsChunk;
        globalCallback = null;
    };
    loadChunk();
};

export const fetchSuggestionsTitles = (name, callback) => {
    if (!name.trim()) {
        callback([]);
        return;
    }

    if (document.getElementById('sug-script')) {
        document.body.removeChild(document.getElementById('sug-script'));
    }
    delete window.handleWikipediaResponse;

    const script = document.createElement('script');
    script.id = 'sug-script';
    script.src = `https://ru.wikipedia.org/w/api.php?action=opensearch&format=json&search=${encodeURIComponent(name)}&namespace=0&limit=15&callback=handleWikipediaResponse`;

    window.handleWikipediaResponse = (data) => {
        const results = Array.isArray(data) && data.length > 1 
            ? data[1].map(title => ({ title }))
            : [];
        callback(results);
        document.body.removeChild(script);
        delete window.handleWikipediaResponse;
    }
    document.body.appendChild(script);
};

export const wikifetch = async (title, revid) => {
    const res = await fetch(`https://ru.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvprop=content&format=json&rvlimit=1&rvstartid=${revid}&origin=*`);
    const data = await res.json();
    return data.query?.pages ? 
                Object.values(data.query.pages)[0].revisions?.[0]["*"] : '';
};

export const wikifetchTexts = async (title, startRevId, limit) => {
    const res = await fetch(`https://ru.wikipedia.org/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}&rvprop=content&format=json&rvlimit=${limit}&rvstartid=${startRevId}&rvdir=newer&origin=*`);
    const data = await res.json();
    return data.query?.pages ? 
                Object.values(data.query.pages)[0].revisions?.map(rev => rev["*"]) : [];
};