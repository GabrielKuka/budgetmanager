import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const THEME_STORAGE_KEY = "theme";
const LIGHT_THEME = "light";
const DARK_THEME = "dark";

const getStoredTheme = () => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
};

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getStoredTheme);
  const isDarkMode = theme === DARK_THEME;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute("content", isDarkMode ? "#111827" : "#5f9ea0");
    }
  }, [theme, isDarkMode]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME
    );
  };

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useThemeContext() {
  const state = useContext(ThemeContext);
  if (state === undefined) {
    throw new Error("no Theme Context found");
  }

  return state;
}

export default ThemeProvider;
