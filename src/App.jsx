import './App.css'
import { Navigate, Outlet } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import Header from './components/custom/Header'
import { Toaster } from './components/ui/sonner'

function App() {
  const {isLoaded,isSignedIn}=useUser();

  if (!isLoaded) return <p>Loading authentication...</p>

  if(!isSignedIn)
  {
    return <Navigate to={'/auth/sign-in'} />
  }

  return (
    <>
      <Header/>
      <Outlet/>
      <Toaster />
    </>
  )
}

export default App
