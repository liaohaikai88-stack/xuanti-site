import { parseStoryboard } from "@/lib/storyboard";

export function StoryboardView({ text }: { text: string }) {
  const parsed = parseStoryboard(text);
  if (parsed.rows.length === 0) return <p className="copy-body">{text}</p>;
  return (
    <div className="storyboard">
      <div className="table-wrap">
        <table className="shot-table">
          <thead>
            <tr>
              <th>镜号</th>
              <th>画面</th>
              <th>台词</th>
              <th>时长</th>
              <th>拍法</th>
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row) => (
              <tr key={`${row.no}-${row.duration}-${row.visual}`}>
                <td>{row.no}</td>
                <td>{row.visual}</td>
                <td>{row.speech}</td>
                <td>{row.duration}</td>
                <td>{row.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parsed.plain ? <p className="copy-body">{parsed.plain}</p> : null}
    </div>
  );
}
