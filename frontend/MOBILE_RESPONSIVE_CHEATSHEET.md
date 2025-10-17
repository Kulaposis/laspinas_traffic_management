# Mobile Responsive Cheatsheet 📱

Quick reference for maintaining mobile responsiveness in the Traffic Management System.

## 🎯 Breakpoints

```css
/* Mobile First Approach */
Default        → Mobile (< 640px)
sm: (640px)    → Small tablets
md: (768px)    → Tablets
lg: (1024px)   → Desktop
xl: (1280px)   → Large desktop
2xl: (1536px)  → Extra large
```

## 📐 Common Responsive Patterns

### Layout

```jsx
// Stack on mobile, row on desktop
<div className="flex flex-col sm:flex-row">

// Single column on mobile, grid on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

// Full width on mobile, auto on desktop
<div className="w-full sm:w-auto">

// Hide on mobile, show on desktop
<div className="hidden sm:block">

// Show on mobile only
<div className="sm:hidden">
```

### Spacing

```jsx
// Responsive padding
className="p-4 sm:p-6 lg:p-8"

// Responsive margin
className="m-2 sm:m-4 lg:m-6"

// Responsive gap
className="gap-3 sm:gap-4 lg:gap-6"

// Responsive space between
className="space-y-4 sm:space-y-6"
```

### Typography

```jsx
// Responsive text size
className="text-xs sm:text-sm md:text-base lg:text-lg"

// Responsive headings
className="text-xl sm:text-2xl lg:text-3xl"

// Truncate text
className="truncate"

// Line clamp
className="line-clamp-2"
```

### Sizing

```jsx
// Responsive width
className="w-full sm:w-1/2 lg:w-1/3"

// Responsive height
className="h-40 sm:h-48 lg:h-64"

// Responsive icon size
className="w-5 h-5 sm:w-6 sm:h-6"
```

## 🎨 Component Templates

### Responsive Card

```jsx
<div className="card">
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
    <Icon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <h3 className="text-base sm:text-lg font-semibold truncate">Title</h3>
      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">Description</p>
    </div>
  </div>
</div>
```

### Responsive Button

```jsx
<button className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 text-sm sm:text-base btn-primary">
  Action
</button>
```

### Responsive Form

```jsx
<form className="space-y-4 sm:space-y-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
    <input className="input-field text-base" />
    <input className="input-field text-base" />
  </div>
</form>
```

### Responsive Modal

```jsx
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
  <div className="bg-white rounded-lg w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
    <div className="p-4 sm:p-6">
      {/* Content */}
    </div>
  </div>
</div>
```

### Responsive Header

```jsx
<div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
  <div className="flex-1 min-w-0">
    <h1 className="text-xl sm:text-2xl font-bold truncate">Title</h1>
    <p className="text-sm sm:text-base text-gray-600">Subtitle</p>
  </div>
  <div className="flex-shrink-0">
    {/* Actions */}
  </div>
</div>
```

## 🎯 Touch-Friendly Guidelines

### Minimum Tap Targets

```jsx
// Buttons should be at least 44x44px
<button className="min-h-[44px] min-w-[44px] p-3">
  <Icon className="w-5 h-5" />
</button>

// Use tap-target class
<button className="tap-target">Click</button>
```

### Active States

```jsx
// Add active state for touch feedback
className="active:scale-95 active:bg-gray-100"

// Hover only on desktop
className="sm:hover:scale-105"
```

### Touch Optimization

```jsx
// Prevent zoom on iOS
<input className="text-base" /> // Must be 16px or larger

// Touch manipulation
<div className="touch-manipulation">

// Prevent text selection
<div className="no-select-mobile">
```

## 📱 Mobile-Specific Utilities

### Custom Classes Available

```css
.touch-manipulation     /* Optimizes touch */
.tap-target            /* Min 44px size */
.hide-scrollbar-mobile /* Hides scrollbar */
.bottom-sheet          /* Mobile bottom sheet */
.modal-mobile          /* Full screen modal */
.sticky-mobile-header  /* Sticky header */
```

### Safe Area Insets (iOS)

```jsx
<div className="safe-area-inset-top">
<div className="safe-area-inset-bottom">
<div className="safe-area-inset-left">
<div className="safe-area-inset-right">
```

## 🔧 Common Fixes

### Fix: Text Too Small
```jsx
// Before
<p className="text-xs">Text</p>

// After
<p className="text-xs sm:text-sm">Text</p>
```

### Fix: Button Too Small
```jsx
// Before
<button className="px-2 py-1">Click</button>

// After
<button className="px-4 py-2.5 sm:py-2">Click</button>
```

### Fix: Content Overflow
```jsx
// Before
<div className="flex">
  <span>Long text that might overflow</span>
</div>

// After
<div className="flex min-w-0">
  <span className="truncate">Long text that might overflow</span>
</div>
```

### Fix: Horizontal Scroll
```jsx
// Add to parent container
<div className="overflow-x-hidden">
  {/* Content */}
</div>
```

### Fix: Images Not Responsive
```jsx
// Before
<img src="..." style={{ width: '400px' }} />

// After
<img src="..." className="w-full h-auto max-w-md" />
```

## 📊 Grid Patterns

### 1-2-3-4 Column Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

### 1-2-4 Column Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### Auto-fit Grid
```jsx
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
```

### Masonry-style
```jsx
<div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
```

## 🎨 Color & Contrast

### Text Colors
```jsx
// Primary text
className="text-gray-900"

// Secondary text
className="text-gray-600"

// Muted text
className="text-gray-500"

// Small text
className="text-xs text-gray-400"
```

### Background Colors
```jsx
// Card background
className="bg-white"

// Page background
className="bg-gray-50"

// Hover state
className="hover:bg-gray-100"

// Active state
className="active:bg-gray-200"
```

## 🚀 Performance Tips

### Optimize Images
```jsx
// Use appropriate sizes
<img 
  src="image.jpg" 
  srcSet="image-small.jpg 480w, image-large.jpg 1080w"
  sizes="(max-width: 640px) 100vw, 50vw"
/>
```

### Lazy Load
```jsx
<img loading="lazy" src="..." />
```

### Reduce Animations on Mobile
```jsx
// Disable hover effects on mobile
className="sm:hover:scale-105"

// Use will-change for better performance
style={{ willChange: 'transform' }}
```

## 📝 Checklist for New Components

- [ ] Responsive layout (flex-col sm:flex-row)
- [ ] Responsive spacing (p-4 sm:p-6)
- [ ] Responsive typography (text-sm sm:text-base)
- [ ] Touch-friendly tap targets (min 44px)
- [ ] Active states for feedback
- [ ] Truncate long text
- [ ] Test on mobile viewport
- [ ] Check horizontal scroll
- [ ] Verify readability
- [ ] Test touch interactions

## 🎯 Quick Test

Open Chrome DevTools → Toggle Device Mode (Ctrl+Shift+M) → Select iPhone 12 → Test:
1. Can I tap everything easily?
2. Is text readable?
3. Does layout look good?
4. No horizontal scroll?
5. Animations smooth?

## 📚 Resources

- **Tailwind Docs**: https://tailwindcss.com/docs/responsive-design
- **Mobile UX**: https://developers.google.com/web/fundamentals/design-and-ux/principles
- **Touch Targets**: https://web.dev/accessible-tap-targets/

## 💡 Pro Tips

1. **Always test on real devices** - Simulators aren't perfect
2. **Use mobile-first approach** - Start with mobile, enhance for desktop
3. **Keep it simple** - Less is more on mobile
4. **Test with one hand** - Most users use phones one-handed
5. **Consider thumb zones** - Bottom corners are easiest to reach
6. **Use native patterns** - iOS and Android users expect certain behaviors
7. **Optimize for slow networks** - Not everyone has 5G
8. **Test in landscape** - Some users prefer landscape mode

## 🔄 Quick Reference

```jsx
// The Mobile Responsive Formula
<Component className="
  // Layout
  flex flex-col sm:flex-row
  
  // Spacing
  p-4 sm:p-6
  gap-3 sm:gap-4
  
  // Typography
  text-sm sm:text-base
  
  // Sizing
  w-full sm:w-auto
  
  // Interactive
  active:scale-95
  sm:hover:scale-105
">
```

Remember: **Mobile users are your primary audience!** 📱✨

