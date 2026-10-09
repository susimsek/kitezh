import type { ReducersMapObject } from "@reduxjs/toolkit";

import auth from "./auth-slice";
import locale from "./locale-slice";
import theme from "./theme-slice";

/* project-needle-add-reducer-import */
const rootReducer = {
  auth,
  locale,
  theme,
  /* project-needle-add-reducer-combine */
} satisfies ReducersMapObject;

export default rootReducer;
