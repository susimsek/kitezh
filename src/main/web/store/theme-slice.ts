import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { Theme } from "@/components/auth/theme";

type ThemeState = {
  value: Theme;
};

const initialState: ThemeState = {
  value: "system",
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.value = action.payload;
    },
  },
});

export const { setTheme } = themeSlice.actions;
export default themeSlice.reducer;
