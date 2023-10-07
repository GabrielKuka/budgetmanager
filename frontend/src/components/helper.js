export const helper = {
   getCurrency: (currency)=>{
    switch(currency){
      case "EUR":
        return "€";
      case "USD":
        return "$";
      case "GBP":
        return "£";
      case "BGN":
        return "лв";
      default:
        return currency
    }
   }  
}