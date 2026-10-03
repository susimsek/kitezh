"use client";

import { Dropdown } from "react-bootstrap";

import type { Dictionary } from "@/i18n/get-dictionary";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/theme-slice";
import { Icon, type IconName } from "@/components/shared/Icon";

import { THEME_STORAGE_KEY, type Theme } from "./theme";

type ThemeSwitcherProps = {
  dictionary: Dictionary;
};

const themeIcons: Record<Theme, IconName> = { system: "desktop", light: "sun", dark: "moon" };

export function ThemeSwitcher({ dictionary }: ThemeSwitcherProps) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.theme.value) as Theme;

  function changeTheme(nextTheme: Theme) {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    dispatch(setTheme(nextTheme));
  }

  const labels: Record<Theme, string> = {
    system: dictionary.theme.system,
    light: dictionary.theme.light,
    dark: dictionary.theme.dark,
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        size="sm"
        className="console-navbar-control"
        aria-label={dictionary.theme.label}
        title={labels[theme]}
      >
        <Icon icon={themeIcons[theme]} className="me-2" />
        <span className="console-navbar-label">{labels[theme]}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {(Object.keys(labels) as Theme[]).map((value) => (
          <Dropdown.Item key={value} active={value === theme} onClick={() => changeTheme(value)}>
            <Icon icon={themeIcons[value]} className="me-2" />
            {labels[value]}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
