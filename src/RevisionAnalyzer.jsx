import { useRevisionAnalysis } from "./useRevisionAnalysis";
import "./RevisionAnalyzer.css";

export default function RevisionAnalyzer({title, revisions, targetRevId, targetRevIndex, startAnalysis}) {
    const targetRevision = revisions.find(r => r.id === targetRevId);
    const {users, progress} = useRevisionAnalysis(title, targetRevision, targetRevIndex, revisions, startAnalysis);

    return (
        <>
            {progress < 100 && startAnalysis ? (
                <div>Прогресс: {progress} %</div>
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