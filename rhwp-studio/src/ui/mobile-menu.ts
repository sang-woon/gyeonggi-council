const MOBILE_BREAKPOINT_PX = 767;
const MOBILE_OPEN_CLASS = 'mobile-open';
const KEYBOARD_OPEN_CLASS = 'keyboard-open';

export class MobileMenu {
  private toggleButton: HTMLButtonElement | null = null;
  private mediaQuery: MediaQueryList;
  private outsideClickHandler: ((e: MouseEvent | TouchEvent) => void) | null = null;

  constructor(private menuBar: HTMLElement) {
    this.mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    this.applyForViewport();
    this.mediaQuery.addEventListener('change', () => this.applyForViewport());
    this.setupKeyboardObserver();
  }

  private applyForViewport(): void {
    if (this.mediaQuery.matches) {
      this.installToggle();
    } else {
      this.removeToggle();
      this.menuBar.classList.remove(MOBILE_OPEN_CLASS);
    }
  }

  private installToggle(): void {
    if (this.toggleButton) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-menu-toggle';
    btn.setAttribute('aria-label', '메뉴 열기');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleOpen();
    });
    this.menuBar.insertBefore(btn, this.menuBar.firstChild);
    this.toggleButton = btn;
  }

  private removeToggle(): void {
    if (!this.toggleButton) return;
    this.toggleButton.remove();
    this.toggleButton = null;
    this.detachOutsideClick();
  }

  private toggleOpen(): void {
    const isOpen = this.menuBar.classList.toggle(MOBILE_OPEN_CLASS);
    if (this.toggleButton) {
      this.toggleButton.setAttribute('aria-expanded', String(isOpen));
      this.toggleButton.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
    }
    if (isOpen) {
      this.attachOutsideClick();
    } else {
      this.detachOutsideClick();
    }
  }

  private attachOutsideClick(): void {
    if (this.outsideClickHandler) return;
    this.outsideClickHandler = (e) => {
      const target = e.target as Node | null;
      if (target && !this.menuBar.contains(target)) {
        this.menuBar.classList.remove(MOBILE_OPEN_CLASS);
        this.detachOutsideClick();
        if (this.toggleButton) {
          this.toggleButton.setAttribute('aria-expanded', 'false');
          this.toggleButton.setAttribute('aria-label', '메뉴 열기');
        }
      }
    };
    document.addEventListener('click', this.outsideClickHandler, true);
    document.addEventListener('touchstart', this.outsideClickHandler, true);
  }

  private detachOutsideClick(): void {
    if (!this.outsideClickHandler) return;
    document.removeEventListener('click', this.outsideClickHandler, true);
    document.removeEventListener('touchstart', this.outsideClickHandler, true);
    this.outsideClickHandler = null;
  }

  private setupKeyboardObserver(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    const layoutHeight = () => window.innerHeight;
    const update = () => {
      const diff = layoutHeight() - vv.height;
      const threshold = layoutHeight() * 0.2;
      const open = diff > threshold;
      document.body.classList.toggle(KEYBOARD_OPEN_CLASS, open);
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${vv.height}px`,
      );
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }
}
