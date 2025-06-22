import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchRevInfo, fetchSuggestionsTitles } from './fetchFunctions'
import RevComboBox from './RevComboBox';
import RevisionAnalyzer from './RevisionAnalyzer';
import './App.css'

function App() {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [revisionInfos, setRevisionInfos] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [selectedRevId, setSelectedRevId] = useState(null);
    const [selectedRevIndex, setSelectedRevIndex] = useState(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [startAnalysis, setStartAnalysis] = useState(false);
    const [progress, setProgress] = useState(0);
    const timeoutRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const fetchSuggestions = useCallback((searchTerm) => {
        fetchSuggestionsTitles(searchTerm, (sugs) => {
            setSuggestions(sugs);
        });
    }, []);

    const loadRevisions = (title) => {
        setIsLoading(true);
        setProgress(0);
        fetchRevInfo(
            title,
            (allRevisions) => {
                setRevisionInfos([...allRevisions.reverse()]);
                setIsLoading(false);
            },
            (count) => setProgress(count)
        );
    };

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [query]);

    
    const handleItemClick = (index) => {
      setQuery(suggestions[index].title);
      inputRef.current?.focus();
      setIsFocused(false);
    };

    const handleAnalyzeClick = () => {
        if (selectedRevId !== null && selectedRevIndex !== null) {
            setStartAnalysis(true);
        }
    };

    return (
        <div className='app'>
            <div className='select-name-panel'>
                <div className="combo-box">
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value); 
                        setIsFocused(true)
                      }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                      placeholder="Искать статью..."
                    />

                    <ul
                      ref={listRef}
                      className="suggestions-list"
                      style={{display: (isFocused) ? 'block' : 'none'}}
                    >
                      {suggestions.length > 0 ? (
                        suggestions.map((item, index) => (
                          <li
                            key={index}
                            onClick={() => handleItemClick(index)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            style={{backgroundColor: index === selectedIndex ? '#545454' : 'transparent'}}
                          >
                            {item.title}
                          </li>
                        ))
                      ) : query ? (
                        <li>Не найдено</li>
                      ) : null}
                    </ul>
                </div>
                <button onClick={() => loadRevisions(query)} disabled={isLoading}>
                    {isLoading ? `Загрузка (${progress})` : 'Загрузить историю'}
                </button>
            </div>
            <div className='select-revision-panel'>
                <button className='analysis-button' onClick={handleAnalyzeClick}>Анализировать авторов</button>
                <RevComboBox revisions={[...revisionInfos].reverse()} setId={setSelectedRevId} setIndex={setSelectedRevIndex}></RevComboBox>
            </div>
            <div className='users-table'>
                <RevisionAnalyzer title={query} revisions={[...revisionInfos]} targetRevId={selectedRevId} targetRevIndex={selectedRevIndex} startAnalysis={startAnalysis}></RevisionAnalyzer>
            </div>
        </div>
    );
}

export default App
