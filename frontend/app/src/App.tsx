import { useState } from 'react'
import { Login } from "./components/Login"
import './App.css'
import { CreateUser } from './components/CreateUser';
import { Users } from './components/Users';
import { Header } from './components/Header';

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("users");

  return (
    <>
      {session ? (
        <>
          <Header currentUser={session.user} page={page} onNav={setPage} onLogout={() => setSession(null)} />
          {page === "users"  && <Users token={session.access_token} />}
          {page === "create" && <CreateUser token={session.access_token} />}
        </>
      ) : (
        <Login onLogin={setSession} />
      )}
    </>
  );
}
