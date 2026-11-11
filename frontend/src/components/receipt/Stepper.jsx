// The four steps up top. current: 1 upload, 2 AI reads it, 3 check and assign.
const STEPS = ['Upload', 'AI reads it', 'Check and assign', 'Save'];

export default function Stepper({ current }) {
  return (
    <ol className="steps" aria-label="Steps to add a receipt">
      {STEPS.map((label, i) => {
        const number = i + 1;
        const state = number < current ? 'done' : number === current ? 'now' : '';
        return (
          <li key={label} className={state || undefined} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="n" aria-hidden="true">{number}</span>
            {label}
            {state === 'done' && <span className="sm mute">Done</span>}
          </li>
        );
      })}
    </ol>
  );
}
