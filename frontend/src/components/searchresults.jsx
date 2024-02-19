import React from "react";
import "./searchresults.scss";

const SearchResults = (props) => {
  return (
    <div className={"searchresults-wrapper"}>
      <div className={"searchresults-wrapper__header"}>
        <label>Search results for: 'query here'</label>
      </div>
      <div className={"searchresults-wrapper__incomes"}>Incomes here</div>
      <div className={"searchresults-wrapper__expenses"}>Expenses here</div>
      <div className={"searchresults-wrapper__transfers"}>Transfers here</div>
    </div>
  );
};

export default SearchResults;
