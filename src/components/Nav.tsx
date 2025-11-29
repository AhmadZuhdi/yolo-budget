import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

export default function Nav(){
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

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
      </nav>
    </>
  )
}
