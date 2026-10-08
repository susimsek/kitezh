import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { defaultLocale, type Locale } from "@/i18n/config";

type LocaleState = {
  value: Locale;
};

const initialState: LocaleState = {
  value: defaultLocale,
};

const localeSlice = createSlice({
  name: "locale",
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.value = action.payload;
    },
  },
});

export const { setLocale } = localeSlice.actions;
export default localeSlice.reducer;
