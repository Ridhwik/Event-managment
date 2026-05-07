import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import "../App.css";


export function LandingPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="landing">
      {/* Animated background layers */}
      <div className="landingBg" aria-hidden>
        <div className="gradientMesh" />
        <div className="noiseOverlay" />
        <div className="landingGrid" />
        <div
          className="cursorGlow"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
          }}
        />
        <div className="landingOrb landingOrb1" />
        <div className="landingOrb landingOrb2" />
        <div className="landingOrb landingOrb3" />
        <div className="landingOrb landingOrb4" />

        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 15}s`,
            }}
          />
        ))}
      </div>

      <header className="landingHeader">
        <div className="landingBrand">
          <div className="brandMark">
            <div className="brandMarkInner">EC</div>
            <div className="brandMarkGlow" />
          </div>
          <div className="brandTextWrap">
            <span className="landingBrandText">EventCo</span>
            <span className="brandTagline">Premium Edition</span>
          </div>
        </div>
        <nav className="landingHeaderLinks">
          <Link to="/login" className="navLink">
            <span className="navLinkIcon">⚡</span>
            Admin
          </Link>
          <Link to="/staff/login" className="navLink">
            <span className="navLinkIcon">👥</span>
            Staff
          </Link>
          <Link to="/employee/login" className="navLink primary">
            <span className="navLinkIcon">✨</span>
            Get Started
          </Link>
        </nav>
      </header>

      <main className="landingMain">
        {/* Hero Section */}
        <div className="heroSection">
          <div className="landingBadge">
            <span className="badgeDot" />
            <span className="badgeText">✨ Next-Gen Event Management</span>
            <span className="badgeArrow">→</span>
          </div>

          <h1 className="landingTitle">
            <span className="titleLine1">Run events,</span>
            <span className="titleLine2">budgets & teams</span>
            <span className="landingTitleAccent">in one place</span>
          </h1>

          <p className="landingSub">
            Choose how you work: full control as an <span className="highlight">administrator</span>,
            collaborate as <span className="highlight">Director or Team Leader</span>, or
            submit bills as an <span className="highlight">employee</span> assigned by your team leader.
          </p>

          <div className="heroCtaWrap">
            <Link to="/login" className="btnHero primary">
              <span>Start Free Trial</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link to="/staff/login" className="btnHero ghost">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
              <span>Watch Demo</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="landingStats">
            <div className="statItem">
              <div className="statIcon">🎯</div>
              <div>
                <div className="statNumber">3+</div>
                <div className="statLabel">Role Types</div>
              </div>
            </div>
            <div className="statDivider" />
            <div className="statItem">
              <div className="statIcon">🔒</div>
              <div>
                <div className="statNumber">100%</div>
                <div className="statLabel">Secure</div>
              </div>
            </div>
            <div className="statDivider" />
            <div className="statItem">
              <div className="statIcon">⚡</div>
              <div>
                <div className="statNumber">24/7</div>
                <div className="statLabel">Available</div>
              </div>
            </div>
            <div className="statDivider" />
            <div className="statItem">
              <div className="statIcon">⭐</div>
              <div>
                <div className="statNumber">4.9</div>
                <div className="statLabel">User Rating</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="cardsSection">
          <div className="sectionHeader">
            <span className="sectionLabel">CHOOSE YOUR ROLE</span>
            <h2 className="sectionTitle">Built for everyone in your team</h2>
          </div>

          <div className="landingCards">
            {/* Administrator Card */}
            <div className="card landingCard cardAdmin">
              <div className="cardShine" />
              <div className="cardBorder" />
              <div className="cardContent">
                <div className="cardTopRow">
                  <div className="landingCardIcon iconAdmin">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="iconPulse" />
                  </div>
                  <div className="cardBadge">FULL ACCESS</div>
                </div>

                <h2 className="landingCardTitle">Administrator</h2>
                <p className="landingCardDesc">
                  Full visibility: users, events, bills, payments, closing sheets, accounts, and permissions.
                </p>

                <ul className="cardFeatures">
                  <li><span className="checkIcon">✓</span> Manage all users & roles</li>
                  <li><span className="checkIcon">✓</span> View all financial reports</li>
                  <li><span className="checkIcon">✓</span> Configure permissions</li>
                  <li><span className="checkIcon">✓</span> Audit logs & analytics</li>
                </ul>

                <div className="landingCardActions">
                  <Link to="/login" className="btn primary cardBtn">
                    <span>Admin Login</span>
                    <span className="btnArrow">→</span>
                  </Link>
                  <Link to="/register" className="btn ghost cardBtn">
                    Create Account
                  </Link>
                </div>
              </div>
            </div>

            {/* Director & Team Leader Card - FEATURED */}
            <div className="card landingCard cardStaff featuredCard">
              <div className="cardShine" />
              <div className="cardBorder" />
              <div className="featuredTag">
                <span className="starIcon">⭐</span>
                Most Popular
              </div>
              <div className="cardContent">
                <div className="cardTopRow">
                  <div className="landingCardIcon iconStaff">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="iconPulse" />
                  </div>
                  <div className="cardBadge">TEAM LEAD</div>
                </div>

                <h2 className="landingCardTitle">Director & Team Leader</h2>
                <p className="landingCardDesc">
                  Create events, see your running assignments, and collaborate with your team — without admin tools.
                </p>

                <ul className="cardFeatures">
                  <li><span className="checkIcon">✓</span> Create & manage events</li>
                  <li><span className="checkIcon">✓</span> Assign tasks to employees</li>
                  <li><span className="checkIcon">✓</span> Track team progress</li>
                  <li><span className="checkIcon">✓</span> Real-time collaboration</li>
                </ul>

                <div className="landingCardActions">
                  <Link to="/staff/login" className="btn primary cardBtn">
                    <span>Staff Login</span>
                    <span className="btnArrow">→</span>
                  </Link>
                  <Link to="/staff/register" className="btn ghost cardBtn">
                    Staff Register
                  </Link>
                </div>
              </div>
            </div>

            {/* Employee Card */}
            <div className="card landingCard cardEmployee">
              <div className="cardShine" />
              <div className="cardBorder" />
              <div className="cardContent">
                <div className="cardTopRow">
                  <div className="landingCardIcon iconEmployee">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <div className="iconPulse" />
                  </div>
                  <div className="cardBadge">FIELD STAFF</div>
                </div>

                <h2 className="landingCardTitle">Employee</h2>
                <p className="landingCardDesc">
                  Upload bills and vouchers, send payment requests, and track approvals for your assigned event categories.
                </p>

                <ul className="cardFeatures">
                  <li><span className="checkIcon">✓</span> Upload bills & vouchers</li>
                  <li><span className="checkIcon">✓</span> Submit payment requests</li>
                  <li><span className="checkIcon">✓</span> Track approval status</li>
                  <li><span className="checkIcon">✓</span> Mobile-friendly access</li>
                </ul>

                <div className="landingCardActions">
                  <Link to="/employee/login" className="btn primary cardBtn">
                    <span>Employee Login</span>
                    <span className="btnArrow">→</span>
                  </Link>
                  <Link to="/employee/register" className="btn ghost cardBtn">
                    Employee Register
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Section */}
        <div className="trustSection">
          <p className="trustText">Trusted by event organizers worldwide</p>
          <div className="trustLogos">
            <span className="trustLogo">🏆 Premium</span>
            <span className="trustLogo">🔐 Encrypted</span>
            <span className="trustLogo">⚡ Lightning Fast</span>
            <span className="trustLogo">🌍 Global Ready</span>
            <span className="trustLogo">💎 Enterprise</span>
          </div>
        </div>
      </main>

      <footer className="landingFooter">
        <div className="footerContent">
          <div className="footerLeft">
            <div className="brandMark small">
              <div className="brandMarkInner">EC</div>
            </div>
            <span className="muted footerText">© 2025 EventCo · All rights reserved</span>
          </div>
          <span className="muted footerText">
            Backend: <code className="footerCode">http://localhost:3000</code>
          </span>
        </div>
      </footer>
    </div>
  );
}