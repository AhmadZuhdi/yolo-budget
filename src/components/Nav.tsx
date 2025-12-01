import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { db } from '../db/indexeddb'
import packageJson from '../../package.json'

export default function Nav(){
  const [isOpen, setIsOpen] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [useBottomNav, setUseBottomNav] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  useEffect(() => {
    // Load bottom nav preference
    db.getMeta<boolean>('useBottomNav').then(pref => {
      if (pref !== undefined) setUseBottomNav(pref)
    })

    // Listen for setting changes
    const handleStorageChange = () => {
      db.getMeta<boolean>('useBottomNav').then(pref => {
        if (pref !== undefined) setUseBottomNav(pref)
      })
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('settingsChanged', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('settingsChanged', handleStorageChange)
    }
  }, [])

  useEffect(() => {
    // Only add swipe gestures for side nav mode
    if (useBottomNav) return

    const onTouchStart = (e: TouchEvent) => {
      setTouchEnd(null)
      setTouchStart(e.targetTouches[0].clientX)
    }

    const onTouchMove = (e: TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX)
    }

    const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return
      
      const distance = touchEnd - touchStart
      const isLeftSwipe = distance < -minSwipeDistance
      const isRightSwipe = distance > minSwipeDistance
      
      // Open menu on right swipe from left edge (within 50px)
      if (isRightSwipe && touchStart < 50) {
        setIsOpen(true)
      }
      
      // Close menu on left swipe when menu is open
      if (isLeftSwipe && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [touchStart, touchEnd, isOpen, useBottomNav])

  // Bottom navigation render
  if (useBottomNav) {
    return (
      <>
        <nav className="bottom-nav">
          <NavLink to="/" className={({isActive})=>isActive? 'active':''} onClick={() => setShowMoreMenu(false)}>
            <span className="icon">📊</span>
            <span className="label">Home</span>
          </NavLink>
          <NavLink to="/transactions" className={({isActive})=>isActive? 'active':''} onClick={() => setShowMoreMenu(false)}>
            <span className="icon">💸</span>
            <span className="label">Transactions</span>
          </NavLink>
          <NavLink to="/accounts" className={({isActive})=>isActive? 'active':''} onClick={() => setShowMoreMenu(false)}>
            <span className="icon">🏛️</span>
            <span className="label">Accounts</span>
          </NavLink>
          <NavLink to="/reports" className={({isActive})=>isActive? 'active':''} onClick={() => setShowMoreMenu(false)}>
            <span className="icon">📈</span>
            <span className="label">Reports</span>
          </NavLink>
          <div style={{position:'relative',display:'flex'}}>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setShowMoreMenu(!showMoreMenu)
              }}
              style={{
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                background:'transparent',
                border:'none',
                color:'var(--text-secondary)',
                padding:'6px 12px',
                cursor:'pointer',
                transition:'all 0.2s ease',
                width:'100%',
                borderRadius:'8px'
              }}
            >
              <span className="icon" style={{fontSize:'1.5rem',marginBottom:2}}>⋯</span>
              <span className="label" style={{fontSize:'0.65rem',fontWeight:500}}>More</span>
            </button>
            {showMoreMenu && (
              <>
                <div 
                  style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:998}} 
                  onClick={() => setShowMoreMenu(false)}
                />
                <div style={{
                  position:'absolute',
                  bottom:'100%',
                  right:0,
                  marginBottom:8,
                  background:'var(--bg-secondary)',
                  border:'1px solid var(--border)',
                  borderRadius:8,
                  boxShadow:'0 -4px 12px rgba(0,0,0,0.15)',
                  minWidth:160,
                  zIndex:999,
                  overflow:'hidden'
                }}>
                <NavLink 
                  to="/budgets" 
                  onClick={() => setShowMoreMenu(false)}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:12,
                    padding:'12px 16px',
                    textDecoration:'none',
                    color:'var(--text)',
                    background:'var(--bg-secondary)',
                    borderBottom:'1px solid var(--border)',
                    transition:'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <span style={{fontSize:'1.25rem'}}>💰</span>
                  <span style={{fontWeight:500}}>Budgets</span>
                </NavLink>
                <NavLink 
                  to="/recurring" 
                  onClick={() => setShowMoreMenu(false)}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:12,
                    padding:'12px 16px',
                    textDecoration:'none',
                    color:'var(--text)',
                    background:'var(--bg-secondary)',
                    borderBottom:'1px solid var(--border)',
                    transition:'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <span style={{fontSize:'1.25rem'}}>🔁</span>
                  <span style={{fontWeight:500}}>Recurring</span>
                </NavLink>
                <NavLink 
                  to="/settings" 
                  onClick={() => setShowMoreMenu(false)}
                  style={{
                    display:'flex',
                    alignItems:'center',
                    gap:12,
                    padding:'12px 16px',
                    textDecoration:'none',
                    color:'var(--text)',
                    background:'var(--bg-secondary)',
                    transition:'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                  <span style={{fontSize:'1.25rem'}}>⚙️</span>
                  <span style={{fontWeight:500}}>Settings</span>
                </NavLink>
              </div>
              </>
            )}
          </div>
        </nav>
      </>
    )
  }

  // Side navigation render (default)

  // Side navigation render (default)
  return (
    <>
      <button 
        className="hamburger" 
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {isOpen && (
        <div className="menu-overlay" onClick={closeMenu}></div>
      )}

      <nav className={`side-nav ${isOpen ? 'open' : ''}`}>
        <div className="side-nav-header">
          <h2>Menu</h2>
          <button className="close-btn" onClick={closeMenu} aria-label="Close menu">✕</button>
        </div>
        <div className="side-nav-links">
          <NavLink to="/" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">📊</span> Dashboard
          </NavLink>
          <NavLink to="/transactions" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">💸</span> Transactions
          </NavLink>
          <NavLink to="/recurring" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">🔁</span> Recurring
          </NavLink>
          <NavLink to="/accounts" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">🏛️</span> Accounts
          </NavLink>
          <NavLink to="/budgets" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">💰</span> Budgets
          </NavLink>
          <NavLink to="/reports" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">📈</span> Reports
          </NavLink>
          <NavLink to="/settings" onClick={closeMenu} className={({isActive})=>isActive? 'active':''}>
            <span className="icon">⚙️</span> Settings
          </NavLink>
        </div>
        <div className="side-nav-footer">
          <div className="version-info">
            <div className="version-label">Version</div>
            <div className="version-value">v{packageJson.version}</div>
          </div>
          <div className="build-info">
            <div className="build-label">Build</div>
            <div className="build-value">{packageJson.name}</div>
          </div>
        </div>
      </nav>
    </>
  )
}
