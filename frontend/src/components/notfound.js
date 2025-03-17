import { React } from "react";
import "./notfound.scss";

const NotFound = () => {
  return (
    <div id="notfound-wrapper">
      The page your are looking for was not found.
      <img src={`${process.env.PUBLIC_URL}/notfound_image.svg`} />
    </div>
  );
};

export default NotFound;
