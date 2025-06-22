import { useState, useRef, useEffect } from "react"
import './RevComboBox.css'

const RevComboBox = ({revisions, setId, setIndex}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedRev, setSelectedRev] = useState(null);
    const comboRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (comboRef.current && !comboRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="rev-combo-box" ref={comboRef}>
            <div className="rev-combo-box-mainline" onClick={() => setIsOpen(!isOpen)}>
                {selectedRev 
                    ? `Version ${selectedRev.id} (${new Date(selectedRev.timestamp).toISOString().replace(/(T|\.000Z)/g, ' ').trimEnd()}; ${selectedRev.user})`
                    : 'Выберите версию...'}
            </div>
            {isOpen && (
              <div className="rev-combo-box-list">
                {revisions.map((rev, ind) => (
                  <div className="rev-combo-box-option"
                    key={rev.id}
                    onClick={() => {
                      setSelectedRev(rev);
                      setId(rev.id);
                      setIndex(revisions.length - 1 - ind);
                      setIsOpen(false);
                    }}
                  >
                    {`Version ${rev.id} (${new Date(rev.timestamp).toISOString().replace(/(T|\.000Z)/g, ' ').trimEnd()}; ${rev.user})`}
                  </div>
                ))}
              </div>
            )}
        </div>
    );
};
export default RevComboBox;