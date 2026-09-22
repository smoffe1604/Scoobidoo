import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import brief from "./content/BRIEF.md?raw";
import scoring from "./content/SCORING.md?raw";

export default function TaskBrief() {
  return (
    <>
      <article className="panel brief">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief}</ReactMarkdown>
      </article>
      <article className="panel brief">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{scoring}</ReactMarkdown>
      </article>
    </>
  );
}
