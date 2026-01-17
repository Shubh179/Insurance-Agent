import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, Menu, Zap, Archive, Clock, Shield, FileText, DollarSign, ShieldAlert, ShieldCheck, Lightbulb, Mail, LogOut } from 'lucide-react';
import './ChatInterface.css';

export default function ChatInterface() {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [isSynced, setIsSynced] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [suggestions, setSuggestions] = useState([
        { id: 1, icon: <FileText size={16} color="#3B82F6" />, text: "What insurance policies do I currently have and are they still active?" },
        { id: 2, icon: <DollarSign size={16} color="#3B82F6" />, text: "Am I paying too much for my insurance? Can you help me find better rates?" },
        { id: 3, icon: <ShieldAlert size={16} color="#3B82F6" />, text: "What should I do if I need to file an insurance claim?" },
        { id: 4, icon: <ShieldCheck size={16} color="#3B82F6" />, text: "Based on my current policies, what coverage gaps do I have?" },
        { id: 5, icon: <Lightbulb size={16} color="#3B82F6" />, text: "Which insurance products would you recommend for me based on my profile?" }
    ]);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const scrollAnchorRef = useRef(null);

    useEffect(() => {
        if (scrollAnchorRef.current) {
            scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    useEffect(() => {
        // Fetch User Profile
        const fetchProfile = async () => {
            const token = localStorage.getItem('session_token');
            console.log("Fetching profile...", token ? "Token present" : "No token");
            if (token) {
                try {
                    const res = await fetch('https://greedy-nightingale-153.convex.site/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log("Profile res status:", res.status);
                    if (res.ok) {
                        const data = await res.json();
                        console.log("Profile data:", data);
                        setUserProfile(data.user);
                    } else {
                        console.error("Profile error:", await res.text());
                    }
                } catch (e) {
                    console.error("Failed to fetch profile", e);
                }
            }
        };
        fetchProfile();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('session_token');
        window.location.reload();
    };

    const handleSend = () => {
        if (!inputValue.trim()) return;
        const userText = inputValue;
        setMessages(prev => [...prev, { text: userText, isUser: true }]);
        setInputValue("");
        setShowSuggestions(false);

        // Simulate thinking...
        setTimeout(() => {
            setMessages(prev => [...prev, { text: "Analysis complete. Based on the underwriting guidelines for Q3, your current liability exposure is within acceptable variance (±2.5%). However, I recommend a review of the umbrella policy addendum attached to your renewal draft.", isUser: false }]);
            setShowSuggestions(true);
        }, 800);
    };

    // Helper to format MCP responses into readable text
    const formatMCPResponse = (type, data) => {
        let text = "";

        // Remove markdown asterisks helper
        const clean = (str) => str ? str.replace(/\*/g, '') : "";

        if (type === 'policy') {
            if (data.policies && data.policies.length > 0) {
                text += `Found ${data.policies.length} policies.\n`;
                data.policies.forEach(p => text += `- ${clean(p.name || "Policy")}\n`);
            } else {
                text += "No active policies found.\n";
            }
            if (data.recommendations && data.recommendations.length > 0) {
                text += "\nRecommendations:\n";
                data.recommendations.forEach(r => text += `- ${clean(r)}\n`);
            }
        } else if (type === 'recommend') {
            if (data.recommendations && Array.isArray(data.recommendations)) {
                data.recommendations.forEach(rec => {
                    text += `${clean(rec.title)}\n`;
                    text += `${clean(rec.description)}\n`;
                    if (rec.action_items) {
                        rec.action_items.forEach(item => text += `- ${clean(item)}\n`);
                    }
                    text += "\n";
                });
            } else if (typeof data.result === 'string') {
                text = clean(data.result);
            }
        } else if (type === 'chat') {
            text += `${clean(data.agent_response)}\n`;
            if (data.suggested_actions && data.suggested_actions.length > 0) {
                text += "\nSuggested Actions:\n";
                data.suggested_actions.forEach(a => text += `- ${clean(a)}\n`);
            }
        } else if (type === 'risk') {
            text += `Risk Level: ${clean(data.risk_level)} (Score: ${data.risk_score})\n`;
            if (data.mitigation_strategies && data.mitigation_strategies.length > 0) {
                text += "\nMitigation Strategies:\n";
                data.mitigation_strategies.forEach(s => text += `- ${clean(s)}\n`);
            }
        } else if (type === 'persona') {
            if (data.persona) {
                text += `Profile: ${clean(data.persona.profile_name)}\n`;
                text += `Risk Profile: ${clean(data.persona.risk_profile)}\n`;
            }
            if (data.reasoning) {
                text += `\nReasoning: ${clean(data.reasoning)}`;
            }
        } else {
            // Fallback for generic text/json
            text = typeof data === 'object' ? JSON.stringify(data, null, 2) : clean(String(data));
        }

        return text.trim();
    };

    const handleCardClick = async (text) => {
        setMessages(prev => [...prev, { text: text, isUser: true }]);
        setShowSuggestions(false);
        setSuggestions(prev => prev.filter(s => s.text !== text));

        // Check for specific MCP actions
        if (text === "What insurance policies do I currently have and are they still active?") {
            try {
                const token = localStorage.getItem('session_token');
                setMessages(prev => [...prev, { text: "Analyzing your policies... (connecting to MCP Policy Agent)", isUser: false }]);

                const response = await fetch('https://greedy-nightingale-153.convex.site/mcp/policy', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    setMessages(prev => [...prev, { text: "Error fetching policies.", isUser: false }]);
                } else {
                    const data = await response.json();
                    setMessages(prev => [...prev, { text: formatMCPResponse('policy', data), isUser: false }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, { text: "Connection error.", isUser: false }]);
            }
            setShowSuggestions(true);
            return;
        }

        if (text === "Am I paying too much for my insurance? Can you help me find better rates?") {
            try {
                const token = localStorage.getItem('session_token');
                setMessages(prev => [...prev, { text: "Analyzing market rates... (connecting to MCP Recommender)", isUser: false }]);

                const response = await fetch('https://greedy-nightingale-153.convex.site/mcp/recommend', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    setMessages(prev => [...prev, { text: "Error fetching recommendations.", isUser: false }]);
                } else {
                    const data = await response.json();
                    setMessages(prev => [...prev, { text: formatMCPResponse('recommend', data), isUser: false }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, { text: "Connection error.", isUser: false }]);
            }
            setShowSuggestions(true);
            return;
        }

        if (text === "What should I do if I need to file an insurance claim?") {
            try {
                const token = localStorage.getItem('session_token');
                setMessages(prev => [...prev, { text: "Consulting protocols... (connecting to MCP Chat Agent)", isUser: false }]);

                const response = await fetch('https://greedy-nightingale-153.convex.site/mcp/chat', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: text
                    })
                });

                if (!response.ok) {
                    setMessages(prev => [...prev, { text: "Error simulating chat.", isUser: false }]);
                } else {
                    const data = await response.json();
                    setMessages(prev => [...prev, { text: formatMCPResponse('chat', data), isUser: false }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, { text: "Connection error.", isUser: false }]);
            }
            setShowSuggestions(true);
            return;
        }

        if (text === "Based on my current policies, what coverage gaps do I have?") {
            try {
                const token = localStorage.getItem('session_token');
                setMessages(prev => [...prev, { text: "Scanning for gaps... (connecting to MCP Risk Agent)", isUser: false }]);

                const response = await fetch('https://greedy-nightingale-153.convex.site/mcp/risk', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    setMessages(prev => [...prev, { text: "Error assessing risk.", isUser: false }]);
                } else {
                    const data = await response.json();
                    setMessages(prev => [...prev, { text: formatMCPResponse('risk', data), isUser: false }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, { text: "Connection error.", isUser: false }]);
            }
            setShowSuggestions(true);
            return;
        }

        if (text === "Which insurance products would you recommend for me based on my profile?") {
            try {
                const token = localStorage.getItem('session_token');
                setMessages(prev => [...prev, { text: "Analyzing profile... (connecting to MCP Persona Agent)", isUser: false }]);

                const response = await fetch('https://greedy-nightingale-153.convex.site/mcp/persona', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });

                if (!response.ok) {
                    setMessages(prev => [...prev, { text: "Error simulating persona.", isUser: false }]);
                } else {
                    const data = await response.json();
                    setMessages(prev => [...prev, { text: formatMCPResponse('persona', data), isUser: false }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, { text: "Connection error.", isUser: false }]);
            }
            setShowSuggestions(true);
            return;
        }

        // Default mock response for other cards
        setTimeout(() => {
            setMessages(prev => [...prev, { text: "I can help with that! However, I don't have a specific agent connected for this query yet.", isUser: false }]);
            setShowSuggestions(true);
        }, 1000);
    }

    const handleSync = async () => {
        try {
            const token = localStorage.getItem('session_token');
            if (!token) {
                // Silent return or redirect to login in real app
                return;
            }

            // UI feedback immediately
            setIsSynced(true);

            // Call backend to start sync
            const response = await fetch('https://greedy-nightingale-153.convex.site/gmail/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                console.error('Sync failed:', await response.text());
                localStorage.removeItem('gmail_synced'); // Revert on failure
                setIsSynced(false);
            } else {
                const data = await response.json();
                console.log('Sync Successful', data);
                localStorage.setItem('gmail_synced', 'true');
            }
        } catch (err) {
            console.error('Error syncing:', err);
        }
    };
    const handleNewSession = () => {
        setMessages([]);
        setIsSynced(false);
        setSuggestions([
            { id: 1, icon: <FileText size={16} color="#3B82F6" />, text: "What insurance policies do I currently have and are they still active?" },
            { id: 2, icon: <DollarSign size={16} color="#3B82F6" />, text: "Am I paying too much for my insurance? Can you help me find better rates?" },
            { id: 3, icon: <ShieldAlert size={16} color="#3B82F6" />, text: "What should I do if I need to file an insurance claim?" },
            { id: 4, icon: <ShieldCheck size={16} color="#3B82F6" />, text: "Based on my current policies, what coverage gaps do I have?" },
            { id: 5, icon: <Lightbulb size={16} color="#3B82F6" />, text: "Which insurance products would you recommend for me based on my profile?" }
        ]);
        setShowSuggestions(true);
        // Also clear local storage if we want to forget the sync state completely for "New Session" context
        localStorage.removeItem('gmail_synced');
    };

    const [showEmailTooltip, setShowEmailTooltip] = useState(false);

    return (
        <div className="chat-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/logo.svg" alt="Logo" style={{ height: '32px', width: 'auto' }} />
                    <span className="brand-name">Agent Insure</span>
                </div>

                <button className="new-chat-btn" onClick={handleNewSession}>
                    <Zap size={16} /> New Session
                </button>

                <div className="nav-group">
                    <div className="nav-label">Workspace</div>
                    <div className="nav-item active"><Clock size={16} /> <span>Recent</span></div>
                    <div className="nav-item"><Archive size={16} /> <span>Archives</span></div>
                </div>



                <div className="user-profile" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0, marginRight: '8px' }}>
                        <div className="avatar" style={{ flexShrink: 0 }}>{userProfile ? userProfile.email[0].toUpperCase() : 'JD'}</div>
                        <div className="user-info" style={{ minWidth: 0, position: 'relative' }}>
                            {showEmailTooltip && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '-10px',
                                    background: '#1e293b',
                                    border: '1px solid #475569',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    zIndex: 50,
                                    marginBottom: '8px',
                                    fontSize: '0.8rem',
                                    color: '#fff',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-all',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                    minWidth: '200px'
                                }}>
                                    {userProfile ? userProfile.email : 'Jonathan Doe'}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '-4px',
                                        left: '20px',
                                        width: '8px',
                                        height: '8px',
                                        background: '#1e293b',
                                        borderBottom: '1px solid #475569',
                                        borderRight: '1px solid #475569',
                                        transform: 'rotate(45deg)'
                                    }}></div>
                                </div>
                            )}
                            <div className="name"
                                onClick={() => setShowEmailTooltip(!showEmailTooltip)}
                                style={{
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer'
                                }}
                                title={userProfile ? userProfile.email : 'Jonathan Doe'}
                            >
                                {userProfile ? userProfile.email : 'Jonathan Doe'}
                            </div>
                            <div className="plan" style={{ fontSize: '0.7rem', opacity: 0.7 }}>Pro License</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Logout">
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>

            <main className="chat-main">
                {/* Header */}
                <header className="chat-header">
                    <div className="header-co">
                        <h2>Insurance AI Agent</h2>
                        <div className="status-badge" style={{ marginTop: '4px' }}>
                            <span className="dot"></span> Online
                        </div>
                    </div>
                </header>



                {/* Scrollable Area */}
                <div className="chat-content">
                    <div className="content-wrapper">
                        {messages.length === 0 ? (
                            <div className="empty-state">
                                <div className="welcome-msg" style={{ width: '100%', maxWidth: '700px', margin: '0 0 16px 0' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(30, 41, 59, 0.5)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <Shield size={20} color="#3B82F6" />
                                        <div style={{ textAlign: 'left' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white', margin: 0, lineHeight: '1.2' }}>Hello! I'm your Insurance AI Agent.</h3>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, lineHeight: '1.2' }}>Ready to analyze your policies and risk exposure.</p>
                                        </div>
                                    </div>
                                </div>

                                <button style={{
                                    background: '#3B82F6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    marginBottom: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '0.9rem',
                                    transition: 'background 0.2s',
                                    opacity: isSynced ? 0.5 : 1,
                                    cursor: isSynced ? 'default' : 'pointer',
                                    pointerEvents: isSynced ? 'none' : 'auto'
                                }}
                                    onClick={handleSync}
                                    onMouseOver={(e) => !isSynced && (e.currentTarget.style.background = '#2563EB')}
                                    onMouseOut={(e) => !isSynced && (e.currentTarget.style.background = '#3B82F6')}
                                >
                                    <Mail size={18} /> {isSynced ? 'Synced' : 'Sync with Gmail'}
                                </button>

                                {isSynced && (
                                    <div className="suggestions-section" style={{ width: '100%', maxWidth: '700px' }}>
                                        <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>Suggested Questions</h4>
                                        <div className="suggestions-list" style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px',
                                            transition: 'opacity 0.3s'
                                        }}>
                                            {suggestions.map((s) => (
                                                <SuggestionCard key={s.id} icon={s.icon} text={s.text} onClick={handleCardClick} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="messages-list">
                                {!isSynced && (
                                    <button style={{
                                        background: '#3B82F6',
                                        color: 'white',
                                        border: 'none',
                                        padding: '10px 24px',
                                        borderRadius: '8px',
                                        fontWeight: '500',
                                        marginBottom: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.9rem',
                                        transition: 'background 0.2s',
                                        cursor: 'pointer',
                                        margin: '0 auto 24px auto'
                                    }}
                                        onClick={handleSync}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#2563EB'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#3B82F6'}
                                    >
                                        <Mail size={18} /> Sync with Gmail
                                    </button>
                                )}
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`message-row ${msg.isUser ? 'user' : 'assistant'}`}>
                                        {!msg.isUser && <div className="agent-avatar-small"><Shield size={20} /></div>}
                                        <div className="message-bubble" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                                    </div>
                                ))}

                                {showSuggestions && isSynced && suggestions.length > 0 && (
                                    <div className="suggestions-section" style={{ width: '100%', maxWidth: '700px', marginTop: '20px', marginLeft: '48px' }}>
                                        <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '4px' }}>Suggested Questions</h4>
                                        <div className="suggestions-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {suggestions.map((s) => (
                                                <SuggestionCard key={s.id} icon={s.icon} text={s.text} onClick={handleCardClick} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollAnchorRef} id="scroll-anchor"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Input */}
                <div className="input-area">
                    <div className="input-wrapper">
                        <input
                            type="text"
                            placeholder="Ask anything about your insurance..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button className="send-btn" onClick={handleSend}><ArrowUp size={18} /></button>
                    </div>
                </div>
            </main>
        </div>
    );
}

function SuggestionCard({ icon, text, onClick }) {
    return (
        <div className="suggestion-card" onClick={() => onClick(text)} style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: 'auto'
        }}>
            <div className="card-icon" style={{
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                flexShrink: 0
            }}>{icon}</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#e2e8f0', textAlign: 'left', lineHeight: '1.4' }}>{text}</p>
        </div>
    )
}
