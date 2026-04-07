import { useState, useEffect } from 'react'
import { Login } from "./components/Login"
import './App.css'
import { CreateUser } from './components/CreateUser';
import { Users } from './components/Users';
import { Header } from './components/Header';
import { Feedbacks } from './components/Feedbacks';
import { Stats } from './components/Stats';

const EXP = 60 * 60 * 1000;

function normalizeRole(role) {
  return role === "viewer" ? "user" : role;
}

function normalizeSession(session) {
  if (!session?.user) {
    return session;
  }

  return {
    ...session,
    user: {
      ...session.user,
      role: normalizeRole(session.user.role),
    },
  };
}

export default function App() {
  const [authenticating, setAuthenticating] = useState(true);
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("users");

  useEffect(() => {
    if (session) {
      return;
    }

    let token;
    
    try {
      token = JSON.parse(localStorage.getItem("_token"));
    } catch (e) {}

    if (token && Date.now() - token.time < EXP) {
      setSession(normalizeSession(token.token));
      setAuthenticating(false);
      return;
    }

    setAuthenticating(false);
  }, [session]);

  const setLogin = (token) => {
      const normalized = normalizeSession(token);
      setSession(normalized);
      localStorage.setItem("_token", JSON.stringify({ token: normalized, time: Date.now() }));
  };

  const onLogout = () => {
    localStorage.removeItem("_token");
    setSession(null);
  }

  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (session && !isAdmin && page === "create") {
      setPage("users");
    }
  }, [session, isAdmin, page]);


  if (authenticating) {
    return null;
  }

  return (
    <>
      {session ? (
        <>
          <Header currentUser={session.user} page={page} onNav={setPage} onLogout={onLogout} />
          {page === "users"  && <Users token={session.access_token} currentUser={session.user} />}
          {page === "create" && isAdmin && <CreateUser token={session.access_token} currentUser={session.user} />}
          {page === "feedback" && <Feedbacks token={session.access_token} />}
          {page === "stats" && <Stats token={session.access_token} currentUser={session.user} />}
        </>
      ) : (
        <Login onLogin={setLogin} />
      )}
    </>
  );
}
