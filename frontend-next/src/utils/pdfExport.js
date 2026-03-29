export const handlePrint = () => {
  // Strategy: Direct window.print() on the current page.
  // Layout and pagination are managed by @media print in CourseGrid.jsx
  window.print();
};
