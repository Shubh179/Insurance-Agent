import React, { useEffect, useState } from 'react';
import { Shield, Activity, Lock } from 'lucide-react';
import './LandingPage.css';

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
);

export default function LandingPage({ onLogin }) {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth) * 20 - 10,
                y: (e.clientY / window.innerHeight) * 20 - 10,
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="landing-page-wrapper">
            {/* Dynamic Background */}
            <div className="landing-bg-layer"></div>
            <div className="landing-grid-overlay"></div>

            {/* Navigation */}
            <nav className="navbar">
                <div className="brand-container">
                    <div className="logo-container">
                        <img src="/logo.svg" alt="Agent Insure Logo" style={{ height: '40px', width: 'auto' }} />
                    </div>
                    <span>Agent Insure</span>
                </div>

                <div className="nav-actions">
                </div>
            </nav>

            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <div className="hero-badge">
                        <span className="dot-pulse">●</span> Systems Operational
                    </div>

                    <h1 className="hero-title">
                        Insurance <br />
                        Reimagined.
                    </h1>

                    <p className="hero-subtitle">
                        The first rule-based underwriting system. Handle claims 10x faster with strong accuracy, live risk insights and customized recommendations.
                    </p>

                    <div className="hero-actions">
                        <button className="btn-google" onClick={() => window.location.href = "https://greedy-nightingale-153.convex.site/auth/google"}>
                            <GoogleIcon /> Continue with Google
                        </button>
                    </div>


                </div>

                <div className="hero-visual">
                    <div
                        className="glass-interface"
                        style={{
                            transform: `rotateY(${-5 + mousePosition.x * 0.5}deg) rotateX(${2 - mousePosition.y * 0.5}deg)`,
                            padding: 0,
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            filter: 'drop-shadow(0 0 80px rgba(139, 92, 246, 0.15))',
                            position: 'relative',
                            top: '-100px'
                        }}
                    >
                        <img
                            src="/ai-core.png"
                            alt="AI Core Intelligence"
                            style={{
                                width: '100%',
                                maxWidth: '580px',
                                height: 'auto',
                                objectFit: 'contain',
                                animation: 'pulse-glow 4s ease-in-out infinite alternate'
                            }}
                        />

                        {/* Floating AI Badge */}
                        <div style={{
                            position: 'absolute',
                            bottom: '15%',
                            left: '5%',
                            background: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(16px)',
                            padding: '16px 28px',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                            transform: 'translateZ(40px)',
                            display: 'flex',
                            gap: '16px',
                            alignItems: 'center'
                        }}>
                            <div className="dot-pulse" style={{ background: '#8B5CF6', width: '12px', height: '12px', borderRadius: '50%', boxShadow: '0 0 10px #8B5CF6' }}></div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Core Processing</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Quantum Node Active</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
