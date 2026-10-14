/*
 * Knowledge base: self-service fix articles for common IT issues.
 * Each article: id, title, category, keywords (extra search terms),
 * steps (what the user tries), escalate (when to log a ticket).
 */
(function (root) {
  const KB = [
    {
      id: "KB001", category: "Password & Access",
      title: "Reset a forgotten or expired password",
      keywords: "forgot password expired reset login sign in cannot log in incorrect password change",
      steps: [
        "Go to the self-service reset page (passwordreset.harbourline.example) from any phone or computer.",
        "Enter your work email and verify with your registered phone or authenticator app.",
        "Choose a new password: at least 14 characters, not used before.",
        "Sign out and back in on your laptop, phone and Outlook so they pick up the new password.",
      ],
      escalate: "You can't verify your identity, or the new password is rejected more than twice.",
    },
    {
      id: "KB002", category: "Password & Access",
      title: "Account locked after too many sign-in attempts",
      keywords: "account locked locked out too many attempts disabled lockout",
      steps: [
        "Wait 15 minutes. Locks clear automatically after that time.",
        "Check your phone and other devices for an old saved password that keeps retrying, and update it.",
        "Sign in again carefully, checking Caps Lock and keyboard language.",
        "If you have forgotten the password, use the self-service reset (KB001).",
      ],
      escalate: "The account is still locked after 15 minutes, or it locks again within an hour.",
    },
    {
      id: "KB003", category: "Password & Access",
      title: "Set up MFA again on a new or lost phone",
      keywords: "mfa authenticator two factor 2fa code new phone lost phone approve sign in request verification",
      steps: [
        "On a computer, sign in to mysignins.microsoft.com with your work account.",
        "Open Security info and remove the old phone.",
        "Select Add sign-in method, choose Authenticator app, and scan the QR code with the new phone.",
        "Approve the test notification to confirm it works.",
      ],
      escalate: "You can't sign in at all to reach Security info. The service desk will issue a temporary access pass.",
    },
    {
      id: "KB004", category: "Password & Access",
      title: "Request access to a shared drive, folder or mailbox",
      keywords: "access permission shared drive folder mailbox sharepoint site request grant",
      steps: [
        "Find out who owns the folder or mailbox (usually your team manager).",
        "Log a request in the portal naming the exact folder or mailbox and the access you need (read or edit).",
        "Your manager approves the request by email; access is applied within one business day.",
        "Sign out and back in after approval so the new access appears.",
      ],
      escalate: "Always log a ticket: access changes need manager approval.",
    },
    {
      id: "KB005", category: "Network & Wi-Fi",
      title: "Wi-Fi keeps dropping out",
      keywords: "wifi wi-fi wireless dropping disconnects connected no internet drops out signal",
      steps: [
        "Turn Wi-Fi off and on, or restart the laptop.",
        "Forget the Harbourline-Staff network and reconnect with your work account.",
        "Move closer to an access point to rule out weak signal.",
        "Run Windows Update to get the latest network driver.",
      ],
      escalate: "Drop-outs continue after these steps, or several people nearby are affected.",
    },
    {
      id: "KB006", category: "Network & Wi-Fi",
      title: "VPN won't connect or keeps disconnecting",
      keywords: "vpn remote home connect disconnects internal sites remote desktop",
      steps: [
        "Check your home internet works by opening a public website.",
        "Fully quit the VPN client and open it again, then reconnect.",
        "Make sure your laptop's date and time are correct. Certificate checks fail if the clock is wrong.",
        "Restart the laptop and try once more on a different network, such as a phone hotspot.",
      ],
      escalate: "The VPN still fails on two different networks.",
    },
    {
      id: "KB007", category: "Network & Wi-Fi",
      title: "No network or internet on a desk computer",
      keywords: "no internet network cable ethernet limited connectivity ip address conflict wall port offline",
      steps: [
        "Check the network cable is clicked in firmly at both ends.",
        "Try a different wall port or cable if one is available.",
        "Restart the computer.",
        "Ask a colleague nearby whether their connection works. If not, it may be a wider outage.",
      ],
      escalate: "Several people or the whole office have no network. Call the service desk straight away (P1).",
    },
    {
      id: "KB008", category: "Email & M365",
      title: "Outlook not sending or receiving email",
      keywords: "outlook email not syncing outbox stuck send receive mailbox full password prompt",
      steps: [
        "Check the bottom of Outlook says Connected, not Working offline.",
        "Close and reopen Outlook.",
        "Check webmail (outlook.office.com). If email works there, the problem is the Outlook app.",
        "If your mailbox is full, empty Deleted Items and archive large old emails.",
      ],
      escalate: "Email also fails in webmail, or Outlook keeps asking for your password.",
    },
    {
      id: "KB009", category: "Email & M365",
      title: "Teams audio, video or call problems",
      keywords: "teams meeting audio microphone camera call crashes join sound",
      steps: [
        "In Teams, open Settings, then Devices, and select the correct speaker, microphone and camera.",
        "Make a test call from the Devices page to check sound.",
        "Close Teams completely (right-click the taskbar icon and choose Quit) and reopen it.",
        "Unplug and replug your headset, or try the laptop's built-in microphone.",
      ],
      escalate: "Audio still fails after a restart, or Teams crashes every time you join.",
    },
    {
      id: "KB010", category: "Email & M365",
      title: "OneDrive or SharePoint files not syncing",
      keywords: "onedrive sync paused sharepoint files not syncing cloud document library",
      steps: [
        "Click the OneDrive cloud icon near the clock and check for an error message.",
        "If sync is paused, select Resume syncing.",
        "Check you have free disk space on the laptop.",
        "Rename any file with unusual characters (such as # or %) or a very long name.",
      ],
      escalate: "Files show a red cross after these steps, or files appear to be missing.",
    },
    {
      id: "KB011", category: "Printing",
      title: "Printer shows as offline or print jobs are stuck",
      keywords: "printer offline stuck queue jobs not printing cannot find printer add printer",
      steps: [
        "Check the printer is on and the screen shows no error.",
        "On your computer, open Printers, open the queue, and cancel stuck jobs.",
        "Remove the printer and add it again from the Harbourline print list.",
        "Restart your computer and print a test page.",
      ],
      escalate: "The printer is offline for everyone, or the same printer keeps going offline.",
    },
    {
      id: "KB012", category: "Printing",
      title: "Paper jams, faded or blank prints",
      keywords: "paper jam faded blank pages toner streaks gibberish copier error code",
      steps: [
        "Follow the arrows on the printer screen to open each door and remove jammed paper gently.",
        "Check the toner level on the printer screen. Facilities hold spare toner at each site.",
        "Print a test page from the printer's own menu.",
        "If prints show strange characters, cancel the job and reinstall the printer (KB011).",
      ],
      escalate: "The printer shows an error code, or jams keep coming back.",
    },
    {
      id: "KB013", category: "Printing",
      title: "Scan to email or folder not working",
      keywords: "scan scanner scan to email folder copier not sending",
      steps: [
        "Check you selected your own email address on the copier, not a saved contact.",
        "Look in your Junk folder. Scans sometimes land there.",
        "Try scanning a single page at a lower resolution, since large scans can be rejected.",
      ],
      escalate: "No scans arrive from the copier for anyone.",
    },
    {
      id: "KB014", category: "Hardware",
      title: "Laptop won't turn on or charge",
      keywords: "laptop won't turn on power charge battery dead charger adapter boot start",
      steps: [
        "Plug the charger directly into a wall socket (not a power board) and check its light is on.",
        "Hold the power button for 20 seconds, release, then press it once.",
        "Try a different charger if a colleague has the same model.",
        "Leave it charging for 30 minutes before trying again.",
      ],
      escalate: "It still won't start. The service desk will arrange a swap or repair.",
    },
    {
      id: "KB015", category: "Hardware",
      title: "Monitor or docking station not working",
      keywords: "monitor dock docking station no signal second screen display flicker usb ports",
      steps: [
        "Check the monitor's power light and its input source setting.",
        "Unplug the dock's cable from the laptop, wait 10 seconds and plug it back in.",
        "Press Windows + P and choose Extend.",
        "Restart the laptop while it's connected to the dock.",
      ],
      escalate: "The screen stays blank, or the dock's lights don't come on.",
    },
    {
      id: "KB016", category: "Software",
      title: "Request new software or a licence",
      keywords: "install software request licence license application program admin rights",
      steps: [
        "Open Company Portal on your laptop and search for the software. Approved apps install with one click.",
        "If it's not listed, log a request with the software name and the business reason.",
        "Paid software needs your manager's approval for the licence cost.",
      ],
      escalate: "The software isn't in Company Portal. Log a request ticket.",
    },
    {
      id: "KB017", category: "Software",
      title: "An application crashes, freezes or shows an error",
      keywords: "crash crashes freezing not responding error message application update failed corrupt",
      steps: [
        "Save your work elsewhere if you can, then close the app fully and reopen it.",
        "Restart the computer.",
        "Run Windows Update and any update offered for the app.",
        "Note the exact error message or take a screenshot to include in a ticket.",
      ],
      escalate: "The app keeps crashing, or a business system shows an error for several people.",
    },
    {
      id: "KB018", category: "Security",
      title: "I clicked a suspicious link or entered my password on a fake site",
      keywords: "phishing suspicious email link clicked fake website hacked password entered scam gift cards",
      steps: [
        "Do not delete the email. Use the Report button in Outlook to report it as phishing.",
        "Change your password immediately using self-service reset (KB001).",
        "Disconnect from Wi-Fi if anything downloaded or a strange program opened.",
        "Contact the service desk by phone now, even if nothing seems wrong.",
      ],
      escalate: "Always escalate. Security incidents are treated as high priority.",
    },
    {
      id: "KB019", category: "Security",
      title: "Lost or stolen laptop or phone",
      keywords: "lost stolen laptop phone device left misplaced",
      steps: [
        "Report it to the service desk immediately so the device can be locked and wiped remotely.",
        "Change your work password (KB001).",
        "If it was stolen, report it to police and keep the reference number.",
      ],
      escalate: "Always escalate straight away.",
    },
    {
      id: "KB020", category: "Onboarding",
      title: "New starter, leaver or role change request",
      keywords: "new starter employee hire onboarding leaver offboarding leaving contractor transfer setup accounts",
      steps: [
        "Managers log new starters at least 5 business days before the start date.",
        "Include the start date, role, team, site and any special software.",
        "For leavers, log the last working day so access is removed and equipment collected.",
      ],
      escalate: "Always log a ticket: the service desk needs the details to prepare accounts and equipment.",
    },
  ];

  if (typeof module !== "undefined" && module.exports) module.exports = KB;
  else root.KB = KB;
})(typeof window !== "undefined" ? window : globalThis);
