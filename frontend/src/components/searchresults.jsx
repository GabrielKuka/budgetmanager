import React from "react";
import "./searchresults.scss";

const SearchResults = (props) => {
  return (
    <div className={"searchresults-wrapper"}>
      <div className={"searchresults-wrapper__header"}>
        <label>Search results for: 'query here'</label>
      </div>
      <div className={"searchresults-wrapper__incomes"}>
        <div className={"header"}>
          <label>INCOMES: </label>
          <div className={"line"}></div>
        </div>
        <div className={"content"}>Incomes here</div>
      </div>
      <div className={"searchresults-wrapper__expenses"}>
        <div className={"header"}>
          <label>EXPENSES:</label>
        </div>
        <div className={"content"}>Expenses here</div>
      </div>
      <div className={"searchresults-wrapper__transfers"}>
        <div className={"header"}>
          <label>TRANSFERS:</label>
        </div>
        <div herediv className={"content"}>
          Transfers here
        </div>
      </div>
    </div>
  );
};

export default SearchResults;
