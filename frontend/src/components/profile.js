import { React, useEffect, useState } from "react";
import userService from "../services/userService";
import "./profile.scss";

const Profile = () => {
  const [userData, setUserData] = useState("");

  useEffect(() => {
    getUserData();
  }, []);

  async function getUserData() {
    const response = await userService.getUserData();
    setUserData(response);
  }

  return (
    <div className={"profile-wrapper"}>
      <div className={"profile-wrapper__sidebar"}>
        <div className={"user-data"}>
          <img
            alt="user-icon"
            src={process.env.PUBLIC_URL + "/user-icon.png"}
          />
          <div>
            Full name: <label>{userData.name}</label>
          </div>
          <div>
            Email: <label>{userData.email}</label>
          </div>
          <div>
            Phone: <label>{userData.phone}</label>
          </div>
        </div>
        <hr />
      </div>
      <div className={"profile-wrapper__board"}>board</div>
    </div>
  );
};

export default Profile;
