import React, { useState, useEffect } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useNavigate } from "react-router-dom";
import "./navbar.scss";
import ConversionTool from "./core/conversiontool";

const Navbar = () => {
  const global = useGlobalContext();
  return (
    <div className={"navbar-wrapper"}>
      {global.authToken ? <LoggedInNavbar /> : <LoggedOutNavbar />}
    </div>
  );
};

export default Navbar;

const LoggedInNavbar = () => {
  const global = useGlobalContext();
  const navigate = useNavigate();
  const handleLogout = () => {
    global.logoutUser();
  };

  const buttons = ["dashboard", "accounts", "profile", "stats", "templates"];
  const [conversionTool, setConversionTool] = useState(false);

  useEffect(() => {
    let location = window.location.pathname.replace("/", "");
    const activeButton = location
      ? document.getElementById(location)
      : document.getElementById("dashboard");
    if (activeButton) {
      activeButton.style.fontWeight = "bold";
    }
  }, []);

  function handlePage(e) {
    const selected = e.target.innerText.toLowerCase();
    navigate(selected);

    buttons.forEach((button) => {
      const btn = document.getElementById(button);
      if (btn && btn.style != null) {
        btn.style.fontWeight = selected == button ? "bold" : "normal";
      }
    });
  }

  return (
    <div className={"navbar-wrapper__loggedin"}>
      <button id="dashboard" onClick={(e) => handlePage(e)}>
        Dashboard
      </button>
      <button id="accounts" onClick={(e) => handlePage(e)}>
        Accounts
      </button>
      <button id="profile" onClick={(e) => handlePage(e)}>
        Profile
      </button>
      <button id="templates" onClick={(e) => handlePage(e)}>
        Templates
      </button>
      <button id="stats" onClick={(e) => handlePage(e)}>
        Stats
      </button>
      <button id="converter" onClick={() => setConversionTool(true)}>
        Convert Currency
      </button>
      {conversionTool && (
        <ConversionTool closePopup={() => setConversionTool(false)} />
      )}
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
};

const LoggedOutNavbar = () => {
  return <div>Logged out</div>;
};
