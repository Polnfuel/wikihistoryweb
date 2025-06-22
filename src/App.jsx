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
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [startAnalysis, setStartAnalysis] = useState(false);
    const [progress, setProgress] = useState(0);
    const timeoutRef = useRef(null);
    const inputRef = useRef(null);
    const comboboxRef = useRef(null);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!comboboxRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleItemClick = (index) => {
      setQuery(suggestions[index].title);
      inputRef.current?.focus();
      setIsOpen(false);
    };

    const handleAnalyzeClick = () => {
        if (selectedRevId !== null && selectedRevIndex !== null && !startAnalysis) {
            setStartAnalysis(true);
        }
    };

    return (
        <div className='app'>
            <div className='select-name-panel'>
                <div className="combo-box" ref={comboboxRef}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value); 
                            setIsOpen(true)
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Искать статью..."
                    />
                    {isOpen && (
                        <ul className="suggestions-list">
                        {suggestions.length > 0 ? (
                            suggestions.map((item, index) => (
                                <li
                                    key={index}
                                    onClick={() => handleItemClick(index)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={index === selectedIndex ? "selected" : ""}
                                >
                                    {item.title}
                                </li>
                            ))
                        ) : query ? (
                            <li>Не найдено</li>
                        ) : null}
                        </ul>
                    )}
                </div>
                <button type='button' onClick={() => loadRevisions(query)} disabled={isLoading}>
                    {isLoading ? `Загрузка (${progress})` : 'Загрузить историю'}
                </button>
            </div>
            <div className='select-revision-panel'>
                <button type='button' className='analysis-button' onClick={handleAnalyzeClick}>Анализировать авторов</button>
                <RevComboBox revisions={[...revisionInfos].reverse()} setId={setSelectedRevId} setIndex={setSelectedRevIndex}></RevComboBox>
            </div>
            <div className='users-table'>
                <RevisionAnalyzer title={query} revisions={[...revisionInfos]} targetRevId={selectedRevId} targetRevIndex={selectedRevIndex} startAnalysis={startAnalysis} setAnalysis={setStartAnalysis}></RevisionAnalyzer>
            </div>
        </div>
    );
}

export default App
