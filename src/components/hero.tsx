"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Hero() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
    const router = useRouter();

  
  const handleSignOut = async () => {
    try {
      // Call server route to clear HttpOnly cookie
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      // (optional) clear client-side data
      localStorage.clear();

      router.push("/login"); // redirect to login page
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <nav className="bg-blue-500 fixed w-full z-20 top-0 start-0 border-default">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <a href="#" className="flex items-center space-x-3 rtl:space-x-reverse">
          <img src="https://flowbite.com/docs/images/logo.svg" className="h-7" alt="Flowbite Logo" />
          <span className="self-center text-xl text-heading font-semibold whitespace-nowrap">Student-site</span>
        </a>

        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((s) => !s)}
          className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-body rounded-base md:hidden hover:bg-neutral-secondary-soft hover:text-heading focus:outline-none focus:ring-2 focus:ring-neutral-tertiary"
          aria-controls="navbar-dropdown"
          aria-expanded={mobileOpen}
        >
          <span className="sr-only">Open main menu</span>
          <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M5 7h14M5 12h14M5 17h14" />
          </svg>
        </button>

        {/* Menu: controlled by mobileOpen */}
        <div className={`${mobileOpen ? "block" : "hidden"} w-full md:block md:w-auto`} id="navbar-dropdown">
          <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-default rounded-base bg-neutral-secondary-soft md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-neutral-primary">
            <li>
              <a href="/" className="block py-2 px-3 text-white bg-brand rounded md:bg-transparent md:text-fg-brand md:p-0" aria-current="page">Home</a>
            </li>

            <li className="relative">
              <button
                onClick={() => setDropdownOpen((s) => !s)}
                className="flex items-center justify-between w-full py-2 px-3 rounded font-medium text-heading md:w-auto hover:bg-neutral-tertiary md:hover:bg-transparent md:border-0 md:hover:text-fg-brand md:p-0"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                Dropdown
                <svg className="w-4 h-4 ms-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu (toggle) */}
              <div className={`${dropdownOpen ? "block" : "hidden"} z-10 bg-neutral-primary-medium border border-default-medium rounded-base shadow-lg w-44 md:absolute md:mt-2`}>
                <ul className="p-2 text-sm text-body font-medium" aria-labelledby="dropdownNvbarButton">
                  <li><a href="#" className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded">Dashboard</a></li>
                  <li><a href="#" className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded">Settings</a></li>
                  <li><a href="#" className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded">Earnings</a></li>
                  <li><a href="#" className="inline-flex items-center w-full p-2 hover:bg-neutral-tertiary-medium hover:text-heading rounded">Sign out</a></li>
                </ul>
              </div>
            </li>

            <li><button onClick={handleSignOut} className="block py-2 px-3 text-heading rounded hover:bg-neutral-tertiary md:hover:bg-transparent md:border-0 md:hover:text-fg-brand md:p-0">Signout</button></li>

          </ul>
        </div>
      </div>
    </nav>
  );
}
