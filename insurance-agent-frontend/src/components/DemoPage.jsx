import { useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyzeCoverage } from '../demo/coverage';
import { demoQuestions, sampleInbox } from '../demo/sampleInbox';
import './BrandingPage.css';
import './DemoPage.css';

const statusLabels = {
  covered: 'Coverage found',
  excluded: 'Exclusion found',
  missing: 'More evidence needed',
  conflict: 'Conflicting evidence',
};

export default function DemoPage() {
  const [topic, setTopic] = useState(demoQuestions[0].topic);
  const [selectedId, setSelectedId] = useState(sampleInbox[0].id);
  const selected = sampleInbox.find(({ id }) => id === selectedId);
  const result = analyzeCoverage(sampleInbox, topic);

  return (
    <div className="branding-page demo-page">
      <header className="branding-bar">
        <Link to="/" className="branding-identity">
          <img src="/logo.svg" alt="" />
          Agent Insure
        </Link>
        <Link to="/branding"><ArrowLeft size={14} aria-hidden="true" /> About</Link>
      </header>
      <main className="branding-content demo-content">
        <header className="demo-intro">
          <h1>Explore a sample insurance inbox</h1>
          <p>Open an email, ask a coverage question, and see which policy clauses support the answer. This demo runs in your browser with fictional emails and rule-based coverage checks.</p>
        </header>

        <div className="demo-workspace">
          <section className="demo-panel" aria-labelledby="demo-inbox">
            <h2 id="demo-inbox"><Mail size={18} aria-hidden="true" /> Sample inbox</h2>
            <div className="demo-choices" aria-label="Sample emails" role="group">
              {sampleInbox.map(({ id, subject }) => (
                <button key={id} type="button" aria-pressed={id === selectedId} onClick={() => setSelectedId(id)}>
                  {subject}
                </button>
              ))}
            </div>
            <article className="demo-message" aria-label="Selected email" aria-live="polite">
              <h3>{selected.subject}</h3>
              <p>{selected.sender}</p>
              <div>{selected.body}</div>
            </article>
          </section>

          <section className="demo-panel" aria-labelledby="demo-ask">
            <h2 id="demo-ask"><FileText size={18} aria-hidden="true" /> Ask about coverage</h2>
            <div className="demo-choices" aria-label="Coverage questions" role="group">
              {demoQuestions.map(({ topic: option, text }) => (
                <button key={option} type="button" aria-pressed={topic === option} onClick={() => setTopic(option)}>
                  {text}
                </button>
              ))}
            </div>
            <div className="demo-review" aria-live="polite">
              <div>
                <h3>Answer</h3>
                <strong className="demo-status">{statusLabels[result.status]}</strong>
                <p>{result.answer}</p>
              </div>
              <div>
                <h3>Sources</h3>
                {result.evidence.length ? (
                  <ul className="demo-evidence">
                    {result.evidence.map(({ message, excerpt }, index) => (
                      <li key={`${message.id}-${index}`}>
                        <a href="#demo-inbox" onClick={() => setSelectedId(message.id)}>{message.subject}</a>
                        <blockquote>{excerpt}</blockquote>
                      </li>
                    ))}
                  </ul>
                ) : <p>No matching policy clauses.</p>}
              </div>
            </div>
          </section>
        </div>

        <section className="demo-flow" aria-labelledby="demo-flow">
          <h2 id="demo-flow">How Agent Insure works</h2>
          <ol>
            <li><strong>Find insurance email.</strong> The signed-in app reads recent Gmail messages and classifies them. Here, {result.classified} of {result.scanned} sample emails were flagged for review.</li>
            <li><strong>Find relevant evidence.</strong> The signed-in app uses saved insurance emails to provide context for analysis. This demo found {result.evidence.length} matching {result.evidence.length === 1 ? 'clause' : 'clauses'}.</li>
            <li><strong>Answer the question.</strong> The signed-in app uses an AI model for analysis. This demo checks the clauses for coverage, exclusions, missing endorsements, or conflicting wording.</li>
          </ol>
          <Link to="/" className="branding-action">Go to Google sign-in <ArrowRight size={17} aria-hidden="true" /></Link>
        </section>
      </main>
    </div>
  );
}
