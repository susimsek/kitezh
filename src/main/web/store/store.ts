import { configureStore } from "@reduxjs/toolkit";

import rootReducer from "./reducers";

export const makeStore = () =>
  configureStore({
    reducer: rootReducer,
    // Auth state contains bearer/id tokens; never expose them through Redux DevTools.
    devTools: false,
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
