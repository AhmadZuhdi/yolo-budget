import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import packageJson from '../../package.json'

export default function Nav(){
  const [isOpen, setIsOpen] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  useEffect(() => {
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
  }, [touchStart, touchEnd, isOpen])

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
