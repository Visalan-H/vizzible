import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Profile from './pages/Profile'
import Compare from './pages/Compare'
import Explore from './pages/Explore'
import './App.css'

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/compare/:userA/:userB" element={<Compare />} />
        <Route path="/:username" element={<Profile />} />
      </Routes>
      <footer className="global-footer">
        built by <a href="https://visalan.me" target="_blank" rel="noopener noreferrer">vizz.</a>
      </footer>
    </>
  )
}

export default App
