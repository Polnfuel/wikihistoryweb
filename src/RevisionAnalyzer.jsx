import { useEffect, useRef, useState } from "react";
import "./RevisionAnalyzer.css";

export default function RevisionAnalyzer({title, revisions, targetRevId, targetRevIndex, startAnalysis, setAnalysis}) {
    const targetRevision = revisions.find(r => r.id === targetRevId);
    const [users, setUsers] = useState(null);
    const [progress, setProgress] = useState(0);
    const workerRef = useRef(null);

    useEffect(() => {
        if (!targetRevision || !startAnalysis) {
            return;
        }
        setUsers(null);
        setProgress(0);
        
        console.time('time');

        workerRef.current = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
        workerRef.current.onmessage = (e) => {
            const { type, value, users: u} = e.data;
            if (type === 'progress') {
                setProgress(value);
            } else if (type === 'done') {
                setUsers(u);
                setAnalysis(false);
                console.timeEnd('time');
                workerRef.current.terminate();
                workerRef.current = null;
            }
        }
        workerRef.current.postMessage({
            title,
            revisions,
            targetRevIndex,
            targetRevision
        });
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        }
    }, [targetRevision, startAnalysis, targetRevIndex]);

    const handleCancel = () => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
            setAnalysis(false);
            setUsers(null);
            setProgress(0);
            console.timeEnd('time');
        }
    }

    return (
        <>
            {progress < 100 && startAnalysis ? (
                <div>
                    <span>Прогресс: {progress} %</span>
                    <button className="cancel-button" type="button" onClick={handleCancel}>Отмена</button>
                </div>
            ) : users ? (
                <table>
                    <thead>
                        <tr>
                            <th>Участник</th>
                            <th>Прав.</th>
                            <th>М.</th>
                            <th>Содерж.</th>
                        </tr>
                    </thead>
                    <tbody>
                       {users.sort((a, b) => {
                            const diffPerc = b.percentageOfContentAdded - a.percentageOfContentAdded;
                            const diffEdits = b.nrOfEdits - a.nrOfEdits;
                            if (diffPerc !== 0) 
                                return diffPerc;
                            else if (diffEdits !== 0)
                                return diffEdits;
                            return a.index - b.index;
                        }).map((user) => (
                            <tr key={user.name}>
                                <td className="user-name">{user.name}</td>
                                <td className="user-edits">{user.nrOfEdits}</td>
                                <td className="user-minor-edits">{user.nrOfMinorEdits}</td>
                                <td className="user-percentage">{user.percentageOfContentAdded} %</td>
                            </tr>
                        ))} 
                    </tbody>
                </table>
            ) : (
                <div></div>
            )}
        </>
    );
};