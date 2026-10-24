/** Shared scope switch: desktop-only runs never execute phone/tablet/touch cases. */
export const desktopOnly = process.env.GA_DESKTOP_ONLY === '1';
export const desktopWidths = widths => desktopOnly ? [1366,1920] : widths;
export const testViewport = (width,height=900) => desktopOnly ? {width:width>=1920?1920:1366,height:width>=1920?1080:768} : {width,height};
