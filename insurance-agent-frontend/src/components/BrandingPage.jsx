import { ArrowRight, FileSearch, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import './BrandingPage.css';

const capabilities = [
  { icon: <Mail size={22} aria-hidden="true" />, title: 'Find insurance emails', detail: 'Sync recent Gmail messages and identify insurance correspondence for review.' },
  { icon: <FileSearch size={22} aria-hidden="true" />, title: 'Understand your policies', detail: 'Ask about coverage and policy details using information from your synced emails.' },
  { icon: <ShieldCheck size={22} aria-hidden="true" />, title: 'Review coverage gaps', detail: 'Use the risk assessment and recommendations to decide what to review with your insurer.' },
];

export default function BrandingPage() {
  return (
    <div className="branding-page">
      <header className="branding-bar">
        <Link to="/" className="branding-identity">
          <img src="/logo.svg" alt="" />
          Agent Insure
        </Link>
        <a href="mailto:shubhshah453@gmail.com">Contact support</a>
      </header>

      <main className="branding-content">
        <section className="branding-hero">
          <div>
            <h1>Understand your insurance inbox.</h1>
            <p>Agent Insure is an AI assistant that helps you find policy details, make sense of coverage, and prepare questions for your insurer.</p>
            <Link className="branding-action" to="/">
              Open Agent Insure <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <img className="branding-art" src="/ai-core.png" alt="" />
        </section>

        <section className="branding-capabilities" aria-label="What Agent Insure does">
          {capabilities.map(({ icon, title, detail }) => (
            <article key={title}>
              {icon}
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </section>

        <section className="branding-access">
          <h2>How we use Google access</h2>
          <p>Google sign-in identifies your account. Agent Insure requests read-only Gmail access and reads recent messages when you sync your inbox. Synced email data is stored in Supabase. The app may send relevant email information to its AI provider to classify messages, analyze policies, and answer questions.</p>
          <p>For questions about Google access or your data, email <a href="mailto:shubhshah453@gmail.com">shubhshah453@gmail.com</a>.</p>
          <p><a href="/privacy-policy">Privacy Policy</a></p>
        </section>
      </main>
    </div>
  );
}
