// The editor and the page renderer share limits and defaults.
export const sizingGroups = {
  'Logo and navigation': [
    ['logoDesktop', 'Desktop logo size', 50, 180, 'Resize the logo in the desktop header and menu.'],
    ['logoPhone', 'Phone logo size', 50, 160, 'Resize the logo on screens up to 700 pixels wide.'],
    ['headerHeight', 'Header height', 85, 160, 'Make the top bar shorter or taller.'],
    ['menuText', 'Menu link size', 75, 150, 'Resize the links inside the navigation menu.']
  ],
  'Headings and buttons': [
    ['heroTitle', 'Hero title size', 60, 160, 'Resize the main title over the homepage banner and project covers.'],
    ['sectionTitle', 'Section heading size', 65, 150, 'Resize headings in built-in sections and project details.'],
    ['projectTitle', 'Project name size', 70, 150, 'Resize names on the project slideshow and project cards.'],
    ['buttonText', 'Button label size', 80, 150, 'Resize the words on enquiry and project buttons.']
  ],
  'Spacing and project cards': [
    ['pageInset', 'Page side spacing', 0, 160, 'Adjust the shared left and right margins. Individual section padding takes priority.'],
    ['cardGap', 'Space between project cards', 0, 180, 'Move the project cards closer together or farther apart.'],
    ['cardWidth', 'Project card width', 60, 160, 'Wider cards fit fewer projects on each row. Cards always fit the available space.'],
    ['cardHeight', 'Project photo height', 60, 160, 'Make the photos on project cards taller or shorter. The image is cropped to fit.']
  ]
};
const settings = Object.values(sizingGroups).flat();
export const sizeDefaults = Object.fromEntries(settings.map(([key]) => [key, 100]));
export function sizeVariables(appearance) {
  return settings.map(([key,,min,max]) => {
    const value = appearance[key];
    const n = value == null || value === '' ? 100 : Number(value);
    const percent = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 100;
    return '--size-' + key + ':' + percent / 100 + ';';
  }).join('');
}
