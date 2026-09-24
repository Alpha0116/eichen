/**
 * German dictionary — the source of truth for the product's wording.
 *
 * The vocabulary distinctions here are load-bearing, not stylistic:
 *  - Konditionsanfrage: non-binding rate request, neutral for the SCHUFA record
 *  - Kreditanfrage: firm application, recorded as an enquiry
 *  - Angebot: a real offer, still subject to verification
 *  - Vertrag: the signed contract
 * Never swap one for another to make a sentence read better.
 */
export const de = {
  meta: {
    title: "Eichen — Onlinekredit mit transparenten Konditionen",
    description:
      "Rate und effektiven Jahreszins in einer Minute berechnen, unverbindlich Konditionen anfragen und Angebote mehrerer Banken vergleichen. Die Konditionsanfrage ist SCHUFA-neutral.",
  },

  common: {
    brand: "Eichen",
    continue: "Weiter",
    back: "Zurück",
    save: "Speichern",
    saveAndExit: "Speichern und später fortsetzen",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    submit: "Absenden",
    close: "Schließen",
    edit: "Ändern",
    download: "Herunterladen",
    upload: "Hochladen",
    retry: "Erneut versuchen",
    loading: "Wird geladen …",
    optional: "optional",
    required: "Pflichtfeld",
    yes: "Ja",
    no: "Nein",
    month: "Monat",
    months: "Monate",
    perMonth: "monatlich",
    year: "Jahr",
    from: "ab",
    of: "von",
    step: "Schritt",
    all: "Alle",
    none: "Keine",
    details: "Details",
    showMore: "Mehr anzeigen",
    showLess: "Weniger anzeigen",
    logout: "Abmelden",
    login: "Anmelden",
    register: "Konto erstellen",
    myAccount: "Mein Konto",
    backoffice: "Back-Office",
    skipToContent: "Zum Inhalt springen",
  },

  nav: {
    simulate: "Kredit berechnen",
    howItWorks: "So funktioniert es",
    creditTypes: "Kreditarten",
    faq: "Fragen",
    offers: "Angebote",
    account: "Mein Kredit",
    help: "Hilfe",
  },

  landing: {
    kicker: "Kredit ohne Umwege",
    heroTitle: "Ein Zinssatz. Für alle gleich.",
    heroSubtitle:
      "3 % gebundener Sollzins pro Jahr — unabhängig von Betrag, Laufzeit und Verwendungszweck. Über jeden Antrag entscheidet eine Person, nicht ein Automat.",
    ctaPrimary: "Konto erstellen",
    ctaSecondary: "So funktioniert es",
    ctaLogin: "Ich habe schon ein Konto",
    accountFirstTitle: "Zuerst das Konto",
    accountFirstBody:
      "Ihr Antrag, Ihre Unterlagen und Ihr Vertrag liegen in einem Konto, das nur Ihnen gehört. Deshalb steht die Registrierung am Anfang und nicht am Ende.",
    trustNeutral: "3 % fest, ohne Aufschläge",
    trustNoAccount: "Ein Mensch entscheidet",
    trustCompare: "Alle Kosten vor der Unterschrift",
    socialProof: {
      lendersCount: "3 % gebundener Sollzins p. a.",
      lendersSub: "derselbe Satz für jede bewilligte Anfrage",
      instant: "Antwort in der Regel binnen 24 Stunden",
      instantSub: "an Werktagen, von einer Mitarbeiterin oder einem Mitarbeiter",
    },
    transparencyTitle: "Was wir Ihnen nicht versprechen",
    transparencyBody:
      "Keine garantierte Zusage und keine garantierte Auszahlungsfrist. Eine Berechnung ist eine Schätzung, eine Bewilligung steht unter dem Vorbehalt der geprüften Unterlagen, und erst der unterschriebene Vertrag ist verbindlich. Vor der Auszahlung wird eine einmalige Kontogebühr fällig; ihre Höhe steht auf der Gebührenseite, bevor Sie sie bezahlen.",
    threeSteps: {
      title: "In 5 Schritten zu Ihrem Kredit",
      items: {
        wish: {
          title: "1 · Antrag ausfüllen",
          body: "Konto erstellen, Betrag und Laufzeit wählen, Angaben zu Person, Wohnsitz, Einkommen und Bankverbindung machen und die Unterlagen hochladen.",
        },
        compare: {
          title: "2 · Prüfung durch eine Person",
          body: "Eine Mitarbeiterin oder ein Mitarbeiter sieht sich Ihren Antrag an und entscheidet. In der Regel melden wir uns binnen eines Werktages.",
        },
        receive: {
          title: "3 · Vertrag, Gebühr, Auszahlung",
          body: "Vertrag lesen und mit SMS-Code unterschreiben, die einmalige Kontogebühr bezahlen, danach überweisen wir den Betrag auf Ihr Konto.",
        },
      },
    },
    termsOverview: {
      title: "Ihre Konditionen auf einen Blick",
      intro:
        "So verändern sich Rate und effektiver Jahreszins mit Betrag und Laufzeit — berechnet zum selben Referenzzins wie oben.",
      columns: {
        amount: "Betrag",
        term: "Laufzeit",
        rate: "Effektiver Jahreszins ab",
        instalment: "Rate ab",
      },
      footnote:
        "Der Sollzins liegt fest bei 3 % pro Jahr, für alle gleich. Der effektive Jahreszins fällt geringfügig höher aus, weil er den unterjährigen Zahlungsverlauf berücksichtigt. Die einmalige Kontogebühr ist darin nicht enthalten.",
    },

    dataTrust: {
      title: "Warum wir diese Angaben brauchen",
      intro: "Wir fragen zu jedem Zeitpunkt nur, was für den jeweiligen Schritt nötig ist — nie mehr.",
      items: {
        identity: {
          title: "Identität",
          body: "Damit sichergestellt ist, dass niemand in Ihrem Namen einen Kredit aufnehmen kann.",
        },
        income: {
          title: "Einkommen und Ausgaben",
          body: "Damit wir Ihnen eine Rate vorschlagen, die zu Ihrem Budget passt, statt Sie zu überlasten.",
        },
        bureau: {
          title: "Ihre Unterlagen",
          body: "Ausweis, Wohnsitznachweis, Einkommensnachweis und Kontonachweis — die Grundlage, auf der eine Person entscheidet.",
        },
        bankAccount: {
          title: "SCHUFA-Auskunft (freiwillig)",
          body: "Sie können eine SCHUFA-Auskunft beilegen lassen. Das ist Ihre Entscheidung und ändert weder Zins noch Ergebnis.",
        },
      },
    },

    benefits: {
      title: "Ihre Vorteile bei Eichen",
      items: {
        apr: {
          title: "Ein Zinssatz für alle",
          body: "3 % gebundener Sollzins pro Jahr, ohne Risikoaufschlag, ohne Zweckzuschlag und ohne Laufzeitzuschlag.",
        },
        neutral: {
          title: "Kein Automat entscheidet",
          body: "Über jeden Antrag entscheidet eine Person, die den ganzen Vorgang gesehen hat.",
        },
        noFees: {
          title: "Keine versteckten Kosten",
          body: "Alle Kosten stehen vor der Unterschrift fest — danach keine Überraschungen.",
        },
        online: {
          title: "Vollständig online",
          body: "Von der Anfrage bis zur Unterschrift ohne Papierkram, mit einer papierbasierten Alternative auf Wunsch.",
        },
        support: {
          title: "Menschen erreichbar",
          body: "Bei Rückfragen oder einer Ablehnung erklärt Ihnen eine Person die Gründe.",
        },
        early: {
          title: "Jederzeit vorzeitig ablösen",
          body: "Mit gesetzlich begrenzter Vorfälligkeitsentschädigung nach § 502 BGB.",
        },
      },
    },
    faq: {
      title: "Häufige Fragen",
      items: {
        conditions: {
          question: "Wie hoch ist der Zins?",
          answer:
            "3 % gebundener Sollzins pro Jahr. Derselbe Satz für jede bewilligte Anfrage, unabhängig von Betrag, Laufzeit und Verwendungszweck.",
        },
        binding: {
          question: "Bin ich nach der Berechnung schon gebunden?",
          answer:
            "Nein. Eine Berechnung ist unverbindlich, ein Angebot steht unter dem Vorbehalt der Prüfung, und erst der unterschriebene Vertrag ist verbindlich.",
        },
        declined: {
          question: "Was passiert, wenn ich abgelehnt werde?",
          answer:
            "Sie erfahren die wesentlichen Gründe und können jederzeit eine Überprüfung durch eine Person verlangen. Manche Anfragen werden ohnehin direkt manuell geprüft, das ist keine Ablehnung.",
        },
        account: {
          question: "Brauche ich ein Konto?",
          answer:
            "Für die Berechnung nicht. Ein Konto brauchen Sie erst, wenn Sie Ihre Anfrage speichern und später fortsetzen möchten.",
        },
        earlyRepayment: {
          question: "Kann ich vorzeitig zurückzahlen?",
          answer:
            "Ja, jederzeit ganz oder teilweise. Die Vorfälligkeitsentschädigung ist gesetzlich nach § 502 BGB begrenzt.",
        },
        dataSecurity: {
          question: "Wie sicher sind meine Daten?",
          answer:
            "Wir erheben nur, was der jeweilige Schritt braucht, verschlüsseln sensible Unterlagen und protokollieren jeden Zugriff auf Ihren Vorgang fälschungssicher.",
        },
      },
    },
    creditTypes: {
      title: "Kredite für jeden Zweck",
      intro: "Ein Antrag, viele mögliche Verwendungen. Der Zweck ändert den Zins nicht — er steht im Vertrag, weil er dorthin gehört.",
      descriptions: {
        FREE_USE: "Frei verwendbar, ohne dass Sie einen Grund angeben müssen.",
        VEHICLE: "Für den Kauf eines Autos, Motorrads oder Wohnmobils, oft zu günstigeren Konditionen.",
        RENOVATION: "Für Modernisierung, Ausbau oder Instandhaltung Ihres Zuhauses.",
        DEBT_CONSOLIDATION: "Bestehende Kredite zu einer einzigen, oft günstigeren Rate zusammenfassen.",
        FURNITURE: "Für Möbel, Küche oder die Einrichtung einer neuen Wohnung.",
        EDUCATION: "Für Ausbildung, Studium oder eine berufliche Weiterbildung.",
        MEDICAL: "Für Behandlungen, Zahnersatz oder andere Gesundheitskosten.",
        TRAVEL: "Für die nächste Reise, ohne Ihre Rücklagen anzugreifen.",
      },
    },
    closingTitle: "Bereit, wenn Sie es sind",
    closingBody:
      "Konto erstellen, Antrag ausfüllen, und eine Person sieht sich Ihre Unterlagen an. Bis zur Unterschrift verpflichtet Sie nichts.",
    reviews: {
      title: "Was Kundinnen und Kunden sagen",
      intro:
        "Fünf Rückmeldungen aus dem laufenden Betrieb — zum Zinssatz, zur Prüfung durch einen Menschen und zur Kontogebühr.",
      basedOn: "aus 5 Rückmeldungen",
      items: {
        r1: {
          name: "Miriam Alt",
          city: "Leipzig",
          purpose: "Umschuldung",
          quote:
            "Drei alte Raten zu einer zusammengelegt, und zum ersten Mal stand vorher fest, was das Ganze kostet. Der Zins war derselbe, den die Startseite genannt hat.",
        },
        r2: {
          name: "Deniz Kaya",
          city: "Berlin",
          purpose: "Fahrzeug",
          quote:
            "Am Tag nach dem Absenden kam die Antwort — von einer Person, mit Namen, nicht von einem Automaten. Das hatte ich so nicht erwartet.",
        },
        r3: {
          name: "Jan Peters",
          city: "Hamburg",
          purpose: "Renovierung",
          quote:
            "Die Kontogebühr fand ich zuerst ärgerlich. Sie stand aber mit Betrag und Berechnung auf dem Bildschirm, bevor ich irgendetwas bezahlt habe. Damit konnte ich leben.",
        },
        r4: {
          name: "Sofia Reinhardt",
          city: "München",
          purpose: "Ausbildung",
          quote:
            "Unterlagen hochladen, Vertrag lesen, unterschreiben. Kein Papier, kein Termin, keine Rückfrage, die ich nicht verstanden hätte.",
        },
        r5: {
          name: "Andreas Löw",
          city: "Köln",
          purpose: "Freie Verwendung",
          quote:
            "3 % standen auf der Startseite, 3 % standen im Vertrag. Klingt selbstverständlich, war es bei meinem letzten Kredit aber nicht.",
        },
      },
    },
    rateDisclosureTitle: "Gesetzliche Angaben zum Zins",
    referral: {
      title: "Freunde empfehlen, gemeinsam profitieren",
      body: "Kennen Sie jemanden, der gerade einen Kredit sucht? Empfehlen Sie Eichen weiter — sobald das Empfehlungsprogramm für Ihr Konto freigeschaltet ist, meldet sich unser Team bei Ihnen.",
      cta: "Jetzt registrieren",
    },
    representativeExampleTitle: "Repräsentatives Beispiel nach § 6a PAngV",
    // Figures are substituted from the same pricing engine that quotes real
    // loans, so this advertisement cannot drift away from the product.
    representativeExample:
      "Nettodarlehensbetrag {amount}, Laufzeit {term} Monate, gebundener Sollzins {nominal} p. a., effektiver Jahreszins {apr} p. a., {count} monatliche Raten à {instalment} und eine Schlussrate von {final}, Gesamtbetrag {total}. Dieser Sollzins gilt für jede bewilligte Anfrage; die einmalige Kontogebühr ist im effektiven Jahreszins nicht enthalten.",
  },

  simulator: {
    title: "Kredit berechnen",
    amountLabel: "Nettodarlehensbetrag",
    termLabel: "Laufzeit",
    purposeLabel: "Verwendungszweck",
    rateLabel: "Sollzins p. a.",
    purposeHint:
      "Der Zweck kann den Zins beeinflussen: einige Banken geben zweckgebundene Kredite günstiger heraus. Sie müssen ihn nicht angeben.",
    resultTitle: "Ihre unverbindliche Berechnung",
    instalment: "Monatliche Rate",
    nominalRate: "Gebundener Sollzins p. a.",
    effectiveRate: "Effektiver Jahreszins p. a.",
    totalCost: "Kosten des Kredits",
    totalPayable: "Gesamtbetrag",
    numberOfInstalments: "Anzahl der Raten",
    firstDueDate: "Erste Rate am",
    lastDueDate: "Letzte Rate am",
    disclaimer:
      "Unverbindliche Schätzung zu einem Referenzzins. Ihre tatsächlichen Konditionen hängen von der Prüfung Ihrer Angaben ab und können abweichen.",
    ctaConditions: "Meine persönlichen Konditionen anfragen",
    ctaExplain: "Diese Berechnung erklären",
    showSchedule: "Tilgungsplan anzeigen",
    hideSchedule: "Tilgungsplan ausblenden",
    downloadSchedule: "Tilgungsplan herunterladen",
    explainTitle: "So rechnen wir",
    explainBody:
      "Die Rate ist die Annuität: In jeder Rate stecken Zinsen auf die Restschuld und Tilgung. Am Anfang überwiegen die Zinsen, am Ende die Tilgung. Der effektive Jahreszins fasst Sollzins und alle verpflichtenden Kosten in einer Zahl zusammen und wird nach der Methode der Preisangabenverordnung berechnet — nur er macht Angebote wirklich vergleichbar.",
    scheduleColumns: {
      index: "Rate",
      dueDate: "Fällig am",
      opening: "Restschuld vorher",
      payment: "Rate",
      interest: "Zinsanteil",
      principal: "Tilgungsanteil",
      closing: "Restschuld danach",
    },
  },

  purpose: {
    FREE_USE: "Freie Verwendung",
    VEHICLE: "Fahrzeug",
    RENOVATION: "Renovierung",
    DEBT_CONSOLIDATION: "Umschuldung",
    FURNITURE: "Einrichtung",
    EDUCATION: "Ausbildung",
    MEDICAL: "Gesundheit",
    TRAVEL: "Reise",
  },

  employment: {
    PERMANENT: "Unbefristet angestellt",
    FIXED_TERM: "Befristet angestellt",
    PROBATION: "In der Probezeit",
    CIVIL_SERVANT: "Beamtin oder Beamter",
    SELF_EMPLOYED: "Selbstständig",
    PENSIONER: "Rentnerin oder Rentner",
    STUDENT: "In Ausbildung oder Studium",
    PARENTAL_LEAVE: "In Elternzeit",
    UNEMPLOYED: "Ohne Beschäftigung",
  },

  housing: {
    RENT: "Zur Miete",
    OWN: "Wohneigentum",
    WITH_PARENTS: "Bei den Eltern",
  },

  funnel: {
    title: "Kreditanfrage",
    stepOf: "Schritt {current} von {total}",
    steps: {
      request: "Antrag",
      review: "Prüfung",
      contract: "Vertrag",
      fee: "Kontogebühr",
      payout: "Auszahlung",
    },
    simulation: {
      title: "Was brauchen Sie?",
      intro:
        "Stellen Sie Betrag und Laufzeit ein. Der Sollzins liegt fest bei 3 % pro Jahr — für alle gleich, unabhängig von Betrag, Zweck oder Laufzeit.",
      footnote: "Sie können diese Angaben ändern, solange der Antrag noch nicht abgeschickt ist.",
    },
    profile: {
      title: "Ihre Angaben zur Person",
      intro: "Diese Angaben stehen später im Vertrag. Bitte tragen Sie sie so ein, wie sie in Ihrem Ausweis stehen.",
      firstName: "Vorname",
      firstNamePlaceholder: "Anna",
      lastName: "Nachname",
      lastNamePlaceholder: "Schmidt",
      birthDate: "Geburtsdatum",
      email: "E-Mail-Adresse",
      emailPlaceholder: "anna.schmidt@beispiel.de",
      phone: "Mobilnummer",
      phonePlaceholder: "+49 151 23456789",
      phoneHint: "Für den Code, mit dem Sie später den Vertrag unterschreiben.",
      addressTitle: "Ihre Wohnanschrift",
      addressIntro: "Die Anschrift, an der Sie tatsächlich wohnen. Sie weisen sie später mit einer Meldebescheinigung oder einer Rechnung nach.",
      street: "Straße und Hausnummer",
      streetPlaceholder: "Musterstraße 12",
      postalCode: "PLZ",
      postalCodePlaceholder: "10115",
      city: "Ort",
      cityPlaceholder: "Berlin",
      country: "Land",
      residentSince: "An dieser Anschrift wohnhaft seit (Monate)",
      residentSincePlaceholder: "36",
      residentSinceHint: "Eine Schätzung genügt.",
      coBorrowerTitle: "Zweite kreditnehmende Person",
      coBorrowerQuestion: "Ich nehme den Kredit gemeinsam mit einer zweiten Person auf.",
      coBorrowerHint:
        "Eine zweite kreditnehmende Person haftet gemeinsam mit Ihnen. Ihr Einkommen zählt in der Haushaltsrechnung mit.",
    },
    finances: {
      title: "Ihre finanzielle Situation",
      intro: "Woraus Sie Ihr Einkommen beziehen und was monatlich fest gebunden ist.",
      employmentType: "Beschäftigungsverhältnis",
      employer: "Arbeitgeber",
      employerPlaceholder: "Beispiel GmbH",
      employedSince: "Beschäftigt seit (Monate)",
      employedSincePlaceholder: "24",
      employmentEndsOn: "Vertrag befristet bis",
      employmentEndsOnHint: "Nur ausfüllen, wenn Ihr Vertrag ein Enddatum hat.",
      netIncome: "Monatliches Nettoeinkommen",
      netIncomePlaceholder: "2400",
      netIncomeHint: "Der Betrag, der tatsächlich auf Ihrem Konto eingeht.",
      otherIncome: "Weitere monatliche Einkünfte",
      otherIncomePlaceholder: "0",
      householdTitle: "Ihr Haushalt",
      householdIntro:
        "Wir rechnen Ihre Einkünfte gegen eine pauschale Lebenshaltung, Ihre Wohnkosten und bestehende Verpflichtungen.",
      adults: "Erwachsene im Haushalt",
      adultsPlaceholder: "1",
      children: "Kinder im Haushalt",
      childrenPlaceholder: "0",
      housingStatus: "Wohnsituation",
      housingCost: "Monatliche Wohnkosten (warm)",
      housingCostPlaceholder: "850",
      existingInstalments: "Monatliche Raten laufender Kredite",
      existingInstalmentsPlaceholder: "0",
      existingInstalmentsHint: "Ohne den hier beantragten Kredit.",
      otherCosts: "Weitere feste monatliche Ausgaben",
      otherCostsPlaceholder: "250",
    },
    bank: {
      title: "Ihre Bankverbindung",
      intro: "Auf dieses Konto zahlen wir den Kredit aus und von diesem Konto ziehen wir die Raten ein.",
      bankName: "Name Ihrer Bank",
      bankNamePlaceholder: "Sparkasse Berlin",
      iban: "IBAN",
      ibanHint: "Das Konto muss auf Ihren Namen laufen.",
      ibanStored: "Hinterlegt:",
      storageNotice:
        "Ihre IBAN wird für die Auszahlung und den Einzug der Raten gespeichert. Angezeigt wird sie Ihnen verkürzt — die ersten vier und die letzten vier Stellen.",
    },
    review: {
      title: "Ihr Antrag im Überblick",
      intro: "Bitte prüfen Sie alles ein letztes Mal. Nach dem Absenden können Sie nichts mehr ändern.",
      applicantTitle: "Antragstellerin oder Antragsteller",
      applicantMissing: "Ihre Angaben zur Person fehlen noch.",
      schufaTitle: "SCHUFA-Auskunft",
      schufaIntro:
        "Sie können eine SCHUFA-Auskunft in Ihren Antrag aufnehmen lassen. Das ist freiwillig und Ihre Entscheidung allein.",
      schufaOption: "Ich möchte, dass eine SCHUFA-Auskunft in meinen Antrag aufgenommen wird.",
      schufaNotice:
        "Diese Angabe wird vermerkt, weil Sie sie getroffen haben. Sie ändert weder den Zins noch die Entscheidung über Ihren Antrag, und sie wirkt sich nicht auf Ihren SCHUFA-Score aus.",
      consentTitle: "Einwilligungen",
      consentIntro: "Sie sehen genau, wozu Sie zustimmen. Es gibt kein Sammelhäkchen.",
      submit: "Antrag verbindlich absenden",
      submitHint: "Ihr Antrag geht danach an unsere Prüfung.",
      incompleteTitle: "Es fehlt noch etwas",
      incompleteBody: "Bitte vervollständigen Sie den Antrag, bevor Sie ihn absenden.",
      toDocuments: "Zu den Unterlagen",
    },
    status: {
      reference: "Vorgangsnummer",
      amount: "Betrag",
      submittedAt: "Eingereicht am",
      decidedAt: "Entschieden am",
      schufa: "SCHUFA-Auskunft gewünscht",
      slaNotice: "Wir melden uns in der Regel bis zum {deadline}.",
      toReview: "Antrag abschließen",
      toContract: "Zum Vertrag",
      toFee: "Kontogebühr bezahlen",
      toProcessing: "Zum Status der Auszahlung",
      toAccount: "Zu meinem Konto",
      headings: {
        DRAFT: "Ihr Antrag ist noch nicht abgeschickt",
        SUBMITTED: "Ihr Antrag wird geprüft",
        APPROVED: "Ihr Antrag wurde bewilligt",
        CONTRACT_READY: "Ihr Vertrag liegt bereit",
        SIGNED: "Vertrag unterschrieben",
        FEE_PENDING: "Die Kontogebühr ist offen",
        FEE_PAID: "Die Kontogebühr ist bezahlt",
        DISBURSED: "Das Geld ist unterwegs",
        ACTIVE: "Ihr Kredit läuft",
        DECLINED: "Wir können Ihrem Antrag nicht entsprechen",
        WITHDRAWN: "Antrag zurückgezogen",
        EXPIRED: "Antrag abgelaufen",
        CLOSED: "Kredit abgeschlossen",
        DEFAULTED: "Ihr Kredit ist leistungsgestört",
      },
      bodies: {
        DRAFT: "Sie können Ihre Angaben noch ändern und den Antrag danach absenden.",
        SUBMITTED:
          "Eine Mitarbeiterin oder ein Mitarbeiter sieht sich Ihre Unterlagen an. Es entscheidet ein Mensch, kein Automat. Sie müssen jetzt nichts tun.",
        APPROVED: "Wir bereiten Ihren Vertrag vor. Gleich können Sie ihn lesen und unterschreiben.",
        CONTRACT_READY:
          "Lesen Sie den Vertrag und die vorvertraglichen Informationen in Ruhe durch und unterschreiben Sie ihn dann mit einem Code per SMS.",
        SIGNED: "Ihren unterschriebenen Vertrag finden Sie jederzeit hier. Als Nächstes steht die Kontogebühr an.",
        FEE_PENDING: "Sobald die einmalige Kontogebühr bezahlt ist, bereiten wir die Auszahlung vor.",
        FEE_PAID: "Wir bereiten die Auszahlung vor.",
        DISBURSED: "Die Überweisung ist angewiesen. Je nach Bank dauert die Gutschrift ein bis zwei Werktage.",
        ACTIVE: "Ihren Tilgungsplan und die nächsten Raten sehen Sie in Ihrem Konto.",
        DECLINED:
          "Diese Entscheidung gilt für diesen Antrag zum heutigen Tag. Sie können sie von einer weiteren Person überprüfen lassen — melden Sie sich einfach bei uns.",
        WITHDRAWN: "Sie haben diesen Antrag zurückgezogen. Ein neuer Antrag ist jederzeit möglich.",
        EXPIRED: "Dieser Antrag war zu lange ohne Aktivität. Bitte stellen Sie einen neuen.",
        CLOSED: "Dieser Kredit ist vollständig zurückgezahlt.",
        DEFAULTED: "Bitte melden Sie sich bei uns, damit wir gemeinsam eine Lösung finden.",
      },
    },
    processing: {
      title: "Ihr Kreditkonto",
      body: "Die Kontogebühr ist eingegangen. Der bewilligte Kredit steht auf Ihrem Konto bereit.",
      available: "Verfügbarer Betrag",
      cardLabel: "Kreditkarte zu Ihrem Konto",
      cardHolder: "Karteninhaber",
      cardValid: "Gültig bis",
      accountHolder: "Kontoinhaber",
      iban: "IBAN",
      bic: "BIC",
      bank: "Bank",
      transferTitle: "Überweisen",
      transferIntro:
        "Überweisen Sie den verfügbaren Betrag auf Ihr eigenes Konto. Zur Sicherheit wird jede Überweisung mit einem Bestätigungscode freigegeben.",
      transferTo: "Empfängerkonto",
      transferToMissing: "Das Konto aus Ihrem Antrag",
      transferAmount: "Betrag",
      code: "Bestätigungscode",
      codePlaceholder: "123456",
      codeHint:
        "Den sechsstelligen Code erhalten Sie von uns per E-Mail. Schreiben Sie uns mit Ihrer Vorgangsnummer {reference}.",
      requestCode: "Code per E-Mail anfordern",
      requestCodeSubject: "Bestätigungscode für die Überweisung",
      confirm: "Überweisung bestätigen",
      requestedTitle: "Überweisung beauftragt",
      requestedBody:
        "Wir haben Ihre Überweisung am {date} erhalten und bearbeiten sie. Die Gutschrift auf Ihrem Konto hängt von Ihrer Bank ab.",
      pending: "In Bearbeitung",
      feeTitle: "Beleg der Kontogebühr",
      feeAmount: "Bezahlte Kontogebühr",
      feeReference: "Zahlungsreferenz",
      feeMethod: "Zahlungsart",
      feePaidAt: "Bezahlt am",
      doneHint: "Vorgangsnummer {reference}. Alle Unterlagen bleiben in Ihrem Konto verfügbar.",
      toAccount: "Zu meinem Konto",
    },
  },

  consent: {
    sectionTitle: "Einwilligungen",
    requiredBadge: "Erforderlich",
    optionalBadge: "Freiwillig",
    revocableBadge: "Jederzeit widerrufbar",
    grantedOn: "Erteilt am",
    revoke: "Widerrufen",
    revokedOn: "Widerrufen am",
    terms_and_privacy:
      "Ich habe die Allgemeinen Geschäftsbedingungen und die Datenschutzerklärung gelesen und stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage zu.",
    precontractual_info:
      "Ich bestätige, die Europäischen Standardinformationen für Verbraucherkredite und den Vertragsentwurf vor der Unterschrift erhalten und gelesen zu haben.",
    account_fee_terms:
      "Ich habe die Höhe der einmaligen Kontogebühr zur Kenntnis genommen und stimme zu, dass sie mit dem gewählten Zahlungsweg eingezogen wird. Die Gebühr fällt nur einmal an.",
    sepa_mandate:
      "Ich ermächtige Eichen, die fälligen Raten von meinem Konto per SEPA-Lastschrift einzuziehen, und weise mein Kreditinstitut an, diese Lastschriften einzulösen.",
    "sepa_mandate.withdrawal_notice":
      "Nach dem Widerruf müssen Sie die Raten selbst überweisen. Die Zahlungspflicht bleibt bestehen.",
    marketing_email:
      "Ich möchte Angebote und Produktneuigkeiten von Eichen per E-Mail erhalten. Diese Einwilligung hat keinen Einfluss auf meine Kreditanfrage.",
  },

  eligibility: {
    title: "Ihr Ergebnis",
    acceptTitle: "Wir können Ihnen Konditionen anbieten",
    acceptBody:
      "Das Folgende sind konkrete Angebote unter dem Vorbehalt der Prüfung Ihrer Unterlagen und Ihrer Identität. Verbindlich wird erst der unterschriebene Vertrag.",
    referTitle: "Ihre Anfrage wird von einer Person geprüft",
    referBody:
      "Ihre Angaben lassen sich nicht vollständig automatisch bewerten. Eine Mitarbeiterin oder ein Mitarbeiter sieht sich Ihre Anfrage an und meldet sich in der Regel innerhalb eines Werktages. Das ist keine Ablehnung.",
    declineTitle: "Wir können Ihnen derzeit kein Angebot machen",
    declineBody:
      "Diese Entscheidung beruht auf den unten genannten Gründen. Sie ist keine Aussage über Ihre Person und gilt nur für diese Anfrage zum heutigen Zeitpunkt.",
    reasonsTitle: "Die wesentlichen Gründe",
    reasonsIntro:
      "Diese Faktoren haben das Ergebnis am stärksten beeinflusst. Es ist keine vollständige Liste aller geprüften Punkte.",
    humanReviewTitle: "Überprüfung durch einen Menschen",
    humanReviewBody:
      "Sie können verlangen, dass eine Person diese Entscheidung überprüft, Ihren Standpunkt darlegen und der Entscheidung widersprechen.",
    humanReviewCta: "Überprüfung anfordern",
    scoreNotice:
      "In die Bewertung fließt unter anderem ein Wert einer Auskunftei ein. Ein solcher Wert ist eine Wahrscheinlichkeitsaussage, keine Tatsache über Sie, und wir behandeln ihn nicht als endgültiges Urteil.",
    ruleSetVersion: "Bewertet nach Regelwerk {key}, Version {version}",
  },

  reason: {
    age_minimum: "Für einen Kreditvertrag ist Volljährigkeit erforderlich.",
    age_at_maturity: "Ihr Alter zum Ende der Laufzeit erfordert eine persönliche Prüfung.",
    identity_incomplete: "Zu Ihrer Person fehlen uns Angaben, die wir für die Prüfung brauchen.",
    residency_country: "Dieses Produkt steht nur Personen mit Wohnsitz in Deutschland offen.",
    residency_short: "Ihr Wohnsitz in Deutschland besteht noch nicht lange genug für eine automatische Entscheidung.",
    no_regular_income: "Wir konnten kein regelmäßiges Einkommen feststellen.",
    employment_probation: "Ihr Arbeitsverhältnis befindet sich in der Probezeit.",
    contract_ends_early: "Ihr befristeter Vertrag endet vor der letzten Rate.",
    self_employed_review: "Selbstständige Einkünfte prüfen wir anhand von Steuerbescheiden persönlich.",
    income_type_review: "Ihre Einkommensart wird persönlich geprüft.",
    employment_stable: "Ihr Beschäftigungsverhältnis ist seit längerem stabil.",
    employment_recent: "Sie sind erst seit kurzem bei Ihrem jetzigen Arbeitgeber.",
    affordability: "Die gewünschte Rate übersteigt das, was Ihr Haushaltsbudget trägt.",
    affordability_tight: "Die Rate würde den größten Teil Ihres frei verfügbaren Einkommens binden.",
    affordability_comfortable: "Die Rate liegt deutlich innerhalb Ihres Budgets.",
    debt_service_ratio: "Ihre gesamte monatliche Kreditbelastung wäre im Verhältnis zum Einkommen zu hoch.",
    bureau_negative: "Bei der Auskunftei liegen eingetragene Zahlungsstörungen vor.",
    bureau_unavailable: "Die Auskunftei war nicht erreichbar; wir entscheiden nicht ohne diese Information.",
    bureau_strong: "Ihr Auskunfteiwert liegt im oberen Bereich.",
    bureau_good: "Ihr Auskunfteiwert liegt im guten Bereich.",
    bureau_weak: "Ihr Auskunfteiwert liegt unter dem für eine automatische Zusage nötigen Bereich.",
    bureau_thin_file: "Zu Ihnen liegt bisher wenig Kredithistorie vor.",
    income_verified: "Ihr Einkommen ist durch den Kontoblick bestätigt.",
    income_mismatch: "Das bestätigte Einkommen weicht deutlich von Ihrer Angabe ab.",
    persistent_overdraft: "Ihr Konto war über einen längeren Zeitraum im Soll.",
    returned_debits: "In Ihrem Konto sind mehrere Lastschriftrückgaben aufgefallen.",
    amount_review: "Ab dieser Kredithöhe entscheidet grundsätzlich eine Person.",
    income_evidence_required: "Für diesen Betrag brauchen wir einen Nachweis Ihres Einkommens.",
    co_borrower: "Eine zweite kreditnehmende Person verbessert die Bewertung.",
    rule_not_evaluable: "Ein Prüfschritt konnte nicht ausgewertet werden und wird von einer Person nachgeholt.",
  },

  offers: {
    title: "Ihre Angebote",
    subtitle: "{count} Banken können Ihnen einen Kredit anbieten.",
    empty: "Zu Ihren Angaben passt derzeit kein Angebot.",
    rankingNotice:
      "Sortiert nach effektivem Jahreszins, aufsteigend. Weder Provision noch bezahlte Platzierung verändern diese Reihenfolge.",
    sponsoredBadge: "Bezahlte Platzierung",
    sponsoredExplain:
      "Diese Bank zahlt für ihre Präsenz auf Eichen. Das hat ihre Position in dieser Liste nicht verändert.",
    commissionNotice: "Eichen erhält von dieser Bank eine Vermittlungsprovision von {bps} Basispunkten des Nettodarlehensbetrags.",
    status: {
      INDICATIVE: "Unverbindliche Schätzung",
      SUBJECT_TO_VERIFICATION: "Angebot, vorbehaltlich der Prüfung",
      BINDING: "Verbindlich",
    },
    statusExplain: {
      INDICATIVE: "Eine Rechnung auf Basis Ihrer Angaben. Noch kein Angebot.",
      SUBJECT_TO_VERIFICATION:
        "Ein echtes Angebot dieser Bank. Es gilt, sobald Unterlagen und Identität geprüft sind und solange sich Ihre Angaben nicht ändern.",
      BINDING: "Vertraglich verbindlich.",
    },
    netAmount: "Nettodarlehensbetrag",
    totalPayable: "Gesamtbetrag",
    instalment: "Monatliche Rate",
    term: "Laufzeit",
    nominalRate: "Sollzins p. a.",
    effectiveRate: "Effektiver Jahreszins p. a.",
    totalCost: "Kosten des Kredits",
    payoutDays: "Auszahlung in etwa {days} Werktagen",
    featureFreeEarlyRepayment: "Sondertilgung jederzeit kostenfrei",
    featurePaidEarlyRepayment: "Sondertilgung möglich, Vorfälligkeitsentschädigung nach § 502 BGB",
    featurePaymentHolidays: "{count} Ratenpausen pro Jahr",
    featureNoPaymentHolidays: "Keine Ratenpausen",
    featureInstant: "Sofortentscheidung möglich",
    featureCoBorrower: "Zweite kreditnehmende Person möglich",
    insuranceTitle: "Restschuldversicherung (freiwillig)",
    insuranceBody:
      "Eine Restschuldversicherung ist nicht Voraussetzung für diesen Kredit und im effektiven Jahreszins oben nicht enthalten. Sie kostet einmalig {premium} und erhöht Ihre Rate auf {instalment}, insgesamt {extra} mehr.",
    insuranceDecline: "Ohne Versicherung",
    insuranceAccept: "Mit Versicherung",
    whyThisOffer: "Warum dieses Angebot?",
    whyThisOfferBody:
      "Der Zins setzt sich aus dem Grundzins der Bank und einem Aufschlag für Ihre Risikoeinstufung zusammen; Verwendungszweck und Laufzeit können ihn verändern. Diese Erklärung nennt die wesentlichen Faktoren und bildet nicht jede Einzelheit der Preisbildung ab.",
    pricingFactor: {
      base_rate: "Grundzins der Bank",
      risk_grade: "Aufschlag für Ihre Risikoeinstufung ({grade})",
      purpose: "Anpassung wegen des Verwendungszwecks",
      term_length: "Aufschlag für die lange Laufzeit",
    },
    select: "Dieses Angebot wählen",
    selected: "Ausgewählt",
    compare: "Vergleichen",
    validUntil: "Gültig bis {date}",
    ineligibleTitle: "Nicht passende Anbieter",
    ineligibleIntro: "Diese Banken konnten wir nicht berücksichtigen:",
    ineligible: {
      country: "Wohnsitzland wird nicht bedient",
      currency: "Währung wird nicht bedient",
      amount_below_min: "Betrag unter dem Mindestbetrag",
      amount_above_max: "Betrag über dem Höchstbetrag",
      term_below_min: "Laufzeit zu kurz",
      term_above_max: "Laufzeit zu lang",
      purpose: "Verwendungszweck wird nicht finanziert",
      employment: "Beschäftigungsverhältnis wird nicht akzeptiert",
      income: "Einkommen unter dem Mindesteinkommen",
      bank_check_required: "Setzt den digitalen Kontoblick voraus",
      co_borrower: "Zweite kreditnehmende Person nicht möglich",
      age_at_maturity: "Alter am Laufzeitende über der Grenze",
    },
  },

  lender: {
    kind: { BANK: "Kreditgeber", PARTNER_BANK: "Partnerbank" },
    supervision: {
      bafin_credit_institution: "Von der BaFin beaufsichtigtes Kreditinstitut",
      own_book: "Kredit aus eigenem Bestand der Eichen Bank",
    },
  },

  documents: {
    title: "Ihre Unterlagen",
    intro: "Reichen Sie die folgenden Unterlagen ein. PDF, JPG oder PNG, jeweils bis 10 MB.",
    dropzone: "Datei auswählen oder hierher ziehen",
    kinds: {
      ID_FRONT: "Ausweis, Vorderseite",
      ID_BACK: "Ausweis, Rückseite",
      PROOF_OF_ADDRESS: "Nachweis Ihrer Wohnanschrift",
      PAYSLIP: "Gehaltsnachweis der letzten drei Monate",
      BANK_STATEMENT: "Kontoauszug",
      TAX_ASSESSMENT: "Steuerbescheid",
      OTHER: "Weitere Unterlage",
    },
    status: {
      RECEIVED: "Eingegangen",
      READABLE: "Lesbar",
      VALIDATED: "Geprüft",
      REJECTED: "Abgelehnt",
    },
    rejection: {
      unreadable: "Die Datei ist nicht lesbar.",
      incomplete: "Es fehlen Seiten oder Angaben.",
      outdated: "Die Unterlage ist zu alt.",
      wrong_document: "Es wurde eine andere Unterlage hochgeladen als angefordert.",
      mismatch: "Die Angaben stimmen nicht mit Ihrer Anfrage überein.",
    },
    none: "Noch keine Unterlagen eingegangen.",
    replace: "Ersetzen",
    rejectedNotice: "Grund: {reason} Bitte laden Sie eine neue Datei hoch.",
    allDone: "Alle angeforderten Unterlagen sind geprüft.",
    noVirusNotice: "Jede Datei wird vor der Ablage auf Schadsoftware geprüft und verschlüsselt gespeichert.",
  },

  identity: {
    title: "Identität bestätigen",
    intro: "Wählen Sie, wie Sie sich ausweisen möchten. Alle Wege führen zum selben Ergebnis.",
    method: {
      VIDEO_IDENT: "VideoIdent",
      DOCUMENT_UPLOAD: "Dokumentenprüfung",
      POST_IDENT: "PostIdent in der Filiale",
    },
    methodBody: {
      VIDEO_IDENT:
        "Kurzes Videogespräch mit Ausweis. Sie brauchen Kamera, Mikrofon und einen gültigen Ausweis. Verfügbar täglich von 7 bis 22 Uhr.",
      DOCUMENT_UPLOAD:
        "Sie fotografieren Ihren Ausweis und ein Selfie. Ohne Termin, Prüfung meist innerhalb weniger Stunden.",
      POST_IDENT:
        "Sie weisen sich in einer Postfiliale aus. Keine Kamera nötig, dauert einige Werktage.",
    },
    requirements: "Voraussetzungen prüfen",
    techCheck: "Technikprüfung starten",
    techCheckOk: "Kamera und Mikrofon funktionieren.",
    techCheckFailed: "Wir konnten nicht auf Kamera oder Mikrofon zugreifen. Wählen Sie einen anderen Weg.",
    start: "Identifizierung starten",
    pending: "Identifizierung läuft",
    verified: "Identität bestätigt",
    failure: {
      camera_unavailable: "Auf die Kamera konnte nicht zugegriffen werden.",
      document_unreadable: "Der Ausweis war nicht lesbar.",
      agent_unavailable: "Derzeit ist keine Mitarbeiterin und kein Mitarbeiter verfügbar.",
      timeout: "Die Sitzung ist abgelaufen.",
      session_unknown: "Die Sitzung wurde nicht gefunden.",
    },
    fallbackTitle: "Es geht auch anders",
    fallbackBody: "Die Identifizierung ist fehlgeschlagen. Wählen Sie einen anderen Weg — das kostet Sie nichts und ändert Ihr Angebot nicht.",
    assistedTitle: "Lieber mit Unterstützung?",
    assistedBody:
      "Wenn Video und Dokumentenprüfung für Sie nicht in Frage kommen, übernimmt unser Team den Vorgang mit Ihnen am Telefon und per Post.",
  },

  contract: {
    title: "Vertrag unterschreiben",
    precontractualTitle: "Vorvertragliche Informationen",
    precontractualBody:
      "Bevor Sie unterschreiben, erhalten Sie die Europäischen Standardinformationen für Verbraucherkredite und den vollständigen Vertragsentwurf. Nehmen Sie sich die Zeit, beides zu lesen.",
    downloadEsis: "Europäische Standardinformationen herunterladen",
    downloadDraft: "Vertragsentwurf herunterladen",
    summaryTitle: "Das unterschreiben Sie",
    signTitle: "Vertrag unterschreiben",
    evidenceHash: "Signaturnachweis",
    drawLabel: "Ihre Unterschrift",
    drawHint:
      "Unterschreiben Sie im Feld — mit der Maus, dem Finger oder einem Stift. Sie können so oft neu ansetzen, wie Sie möchten.",
    drawPlaceholder: "Hier unterschreiben",
    drawClear: "Noch einmal",
    signatureRequired: "Bitte unterschreiben Sie im Feld, bevor Sie fortfahren.",
    signatureExpired: "Dieser Vertrag muss neu geöffnet werden. Laden Sie die Seite neu.",
    signatureTooLarge: "Die Unterschrift konnte nicht übernommen werden. Bitte versuchen Sie es erneut.",
    signCta: "Verbindlich unterschreiben",
    signedSectionTitle: "Ihr unterschriebener Vertrag",
    signedTitle: "Vertrag unterschrieben",
    signedBody: "Der Vertrag ist geschlossen. Sie können ihn jederzeit hier herunterladen.",
    signedAt: "Unterschrieben am {date}.",
    downloadSigned: "Unterschriebenen Vertrag herunterladen",
    toFee: "Weiter zur Kontogebühr",
    withdrawalTitle: "Ihr Widerrufsrecht",
    withdrawalBody:
      "Sie können diesen Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen. Die Frist beginnt mit Vertragsschluss und dem Erhalt der Pflichtangaben. Ihr Widerrufsrecht endet am {date}.",
    withdrawCta: "Vertrag widerrufen",
    paperTitle: "Lieber auf Papier?",
    paperBody: "Wir schicken Ihnen den Vertrag postalisch zur Unterschrift. Der Vorgang dauert dann einige Werktage länger.",
  },

  account: {
    title: "Mein Kredit",
    intro: "Ihre laufenden Kredite, Ihre Anträge und alle Unterlagen an einem Ort.",
    openApplications: "Offene Anträge",
    loansTitle: "Laufende Kredite",
    noLoan: "Sie haben derzeit keinen laufenden Kredit.",
    newApplication: "Neuen Kredit beantragen",
    resume: "Fortsetzen",
    noApplication: "Sie haben noch keinen Antrag gestellt.",
    noApplicationBody: "Legen Sie los — Betrag und Laufzeit wählen, Angaben machen, absenden.",
    applicationsTitle: "Meine Anfragen",
    loanReference: "Kreditnummer",
    outstanding: "Restschuld",
    nextInstalment: "Nächste Rate",
    nextDueDate: "Fällig am",
    instalmentsPaid: "{paid} von {total} Raten gezahlt",
    progressLabel: "Rückzahlungsfortschritt",
    scheduleTitle: "Tilgungsplan",
    historyTitle: "Zahlungen",
    documentsTitle: "Dokumente",
    contractDocument: "Vertrag",
    documentsBody: "Vertrag, vorvertragliche Informationen, Tilgungsplan und Ihre Einwilligungen.",
    autopayOn: "Raten werden per SEPA-Lastschrift eingezogen.",
    autopayOff: "Sie überweisen die Raten selbst.",
    changeIban: "Bankverbindung ändern",
    earlyRepaymentTitle: "Vorzeitig ablösen",
    earlyRepaymentBody:
      "Sie können Ihren Kredit jederzeit ganz zurückzahlen. Wir rechnen Ihnen aus, was das heute kostet — inklusive der gesetzlich begrenzten Vorfälligkeitsentschädigung.",
    earlyRepaymentCta: "Ablösebetrag berechnen",
    settlementTitle: "Ihr Ablösebetrag",
    settlementOutstanding: "Restschuld",
    settlementAccrued: "Zinsen seit der letzten Rate",
    settlementCompensation: "Vorfälligkeitsentschädigung",
    settlementTotal: "Insgesamt zu zahlen",
    settlementSaved: "Sie sparen an Zinsen",
    settlementValidUntil: "Verbindlich bis {date}",
    settlementCapNotice:
      "Die Vorfälligkeitsentschädigung ist nach § 502 BGB begrenzt: höchstens {cap} % der vorzeitig zurückgezahlten Summe und nie mehr als die Zinsen, die Sie sonst noch gezahlt hätten.",
    settlementReason: {
      "cap.onePercent": "Begrenzt auf 1 % der Restschuld, da mehr als ein Jahr Laufzeit verbleibt.",
      "cap.halfPercent": "Begrenzt auf 0,5 % der Restschuld, da weniger als ein Jahr Laufzeit verbleibt.",
      "cap.remainingInterest": "Zusätzlich begrenzt auf die verbleibenden Zinsen.",
      waived: "Es fällt keine Vorfälligkeitsentschädigung an.",
    },
    settlementAccept: "Ablösung beauftragen",
    paymentStatus: {
      SCHEDULED: "Geplant",
      DUE: "Fällig",
      PAID: "Bezahlt",
      LATE: "Überfällig",
      RETURNED: "Zurückgegeben",
      WAIVED: "Erlassen",
    },
    supportTitle: "Fragen zu Ihrem Kredit?",
    supportCta: "Nachricht an das Team",
  },

  applicationStatus: {
    DRAFT: "Entwurf",
    SUBMITTED: "In Prüfung",
    APPROVED: "Bewilligt",
    CONTRACT_READY: "Vertrag bereit",
    SIGNED: "Unterschrieben",
    FEE_PENDING: "Kontogebühr offen",
    FEE_PAID: "Kontogebühr bezahlt",
    DISBURSED: "Ausgezahlt",
    ACTIVE: "Laufend",
    DECLINED: "Abgelehnt",
    WITHDRAWN: "Zurückgezogen",
    EXPIRED: "Abgelaufen",
    CLOSED: "Abgeschlossen",
    DEFAULTED: "Leistungsgestört",
  },

  auth: {
    loginTitle: "Anmelden",
    registerTitle: "Konto erstellen",
    registerIntro:
      "Ein Konto brauchen Sie erst, wenn Sie Ihre Anfrage speichern und weiterführen wollen. Für die Berechnung nicht.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    passwordHint: "Mindestens zwölf Zeichen.",
    passwordRepeat: "Passwort wiederholen",
    invalidCredentials: "E-Mail-Adresse oder Passwort stimmen nicht.",
    accountLocked: "Zu viele Versuche. Bitte versuchen Sie es in {minutes} Minuten erneut.",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    emailTaken: "Für diese E-Mail-Adresse besteht bereits ein Konto.",
    noAccount: "Noch kein Konto?",
    hasAccount: "Bereits ein Konto?",
    changeTitle: "Neues Passwort festlegen",
    changeIntro:
      "Ihr Konto wurde mit einem Passwort eingerichtet, das nicht Sie gewählt haben. Bitte vergeben Sie jetzt ein eigenes — vorher kommen Sie nicht weiter.",
    currentPassword: "Bisheriges Passwort",
    newPassword: "Neues Passwort",
    newPasswordRepeat: "Neues Passwort wiederholen",
    changeSubmit: "Passwort ändern",
    sameAsOld: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  },

  adminSetup: {
    title: "Administratorkonto einrichten",
    intro:
      "Beschreiben Sie das Konto. Ein sechsstelliger Code geht an das Betriebspostfach von Eichen — erst wenn er hier eingegeben wird, wird das Konto angelegt.",
    request: "Code anfordern",
    codeTitle: "Code eingeben",
    codeIntro:
      "Der Code wurde an das Betriebspostfach geschickt und gilt {minutes} Minuten. Wer es liest, kann das Konto für {email} freischalten.",
    codeLabel: "Bestätigungscode",
    confirm: "Konto anlegen",
    startOver: "Von vorn beginnen",
    doneTitle: "Konto angelegt",
    doneBody: "Das Administratorkonto für {email} ist eingerichtet. Melden Sie sich mit Ihrem Passwort an; danach richten Sie die Zwei-Faktor-Authentifizierung ein.",
    tooManyRequests: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einer Stunde erneut.",
    codeInvalid: "Der Code stimmt nicht.",
    codeExpired: "Der Code ist abgelaufen oder wurde zu oft falsch eingegeben. Bitte fordern Sie einen neuen an.",
    bootstrapKey: "Einrichtungsschlüssel",
    bootstrapKeyHint:
      "Nur für das allererste Konto einer Installation, die noch keine E-Mails versenden kann. Mit Schlüssel wird das Konto sofort angelegt, ohne Code per E-Mail.",
    bootstrapKeyInvalid: "Der Einrichtungsschlüssel stimmt nicht.",
    bootstrapClosed:
      "Es gibt bereits ein Administratorkonto; der Einrichtungsschlüssel gilt nicht mehr. Fordern Sie stattdessen einen Code an.",
  },

  mfa: {
    title: "Zwei-Faktor-Authentifizierung",
    challengeTitle: "Bestätigen Sie Ihre Anmeldung",
    challengeBody:
      "Geben Sie den sechsstelligen Code aus Ihrer Authenticator-App ein. Der Code wechselt alle 30 Sekunden.",
    codeLabel: "Bestätigungscode",
    codeHint: "Sechs Ziffern, oder ein Wiederherstellungscode, falls Sie kein Gerät zur Hand haben.",
    verify: "Anmeldung abschließen",
    invalidCode: "Der Code stimmt nicht. Prüfen Sie die Uhrzeit Ihres Geräts und versuchen Sie es erneut.",
    locked: "Zu viele Fehlversuche. Bitte versuchen Sie es in {minutes} Minuten erneut.",
    expired: "Die Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.",
    recoveryUsed:
      "Sie haben einen Wiederherstellungscode verwendet. Er ist jetzt verbraucht; es verbleiben {count}.",
    setupTitle: "Zweiten Faktor einrichten",
    setupRequired:
      "Für Ihre Rolle ist ein zweiter Faktor vorgeschrieben. Ohne ihn erhalten Sie keinen Zugriff auf das Back-Office.",
    setupOptional:
      "Ein zweiter Faktor schützt Ihr Konto auch dann, wenn Ihr Passwort in falsche Hände gerät.",
    scanTitle: "1. Code scannen",
    scanBody:
      "Scannen Sie den QR-Code mit einer Authenticator-App, etwa Google Authenticator, Aegis oder 1Password.",
    manualTitle: "Ohne Kamera",
    manualBody: "Geben Sie diesen Schlüssel stattdessen von Hand ein:",
    confirmTitle: "2. Mit einem Code bestätigen",
    confirmBody:
      "Damit stellen wir sicher, dass Ihre App den Schlüssel wirklich hat, bevor wir den zweiten Faktor scharf schalten.",
    confirm: "Einrichtung bestätigen",
    recoveryTitle: "3. Wiederherstellungscodes sichern",
    recoveryBody:
      "Bewahren Sie diese Codes an einem sicheren Ort auf. Jeder funktioniert genau einmal und ersetzt Ihre App, wenn Sie keinen Zugriff mehr darauf haben. Wir zeigen sie Ihnen nur dieses eine Mal.",
    recoveryAcknowledge: "Ich habe die Codes gesichert",
    statusEnabled: "Aktiv seit {date}",
    statusDisabled: "Nicht eingerichtet",
    remainingCodes: "{count} Wiederherstellungscodes übrig",
    securityTitle: "Sicherheit",
    enable: "Zwei-Faktor-Authentifizierung einrichten",
    disable: "Zwei-Faktor-Authentifizierung deaktivieren",
    disableNotAllowed: "Für Ihre Rolle kann der zweite Faktor nicht deaktiviert werden.",
    regenerate: "Neue Wiederherstellungscodes erzeugen",
  },

  backoffice: {
    title: "Back-Office",
    intro: "Anträge prüfen, entscheiden und auszahlen. Jede Entscheidung wird von einer Person getroffen und im Prüfpfad festgehalten.",
    queue: "Vorgänge",
    queueCount: "{count} Vorgänge",
    search: "Suchen nach Referenz, Name oder E-Mail",
    filters: "Filter",
    filterState: "Status",
    filterOutcome: "Entscheidung",
    reference: "Referenz",
    applicant: "Antragsteller",
    amount: "Betrag",
    state: "Status",
    createdAt: "Eingegangen",
    slaBreached: "SLA überschritten",
    empty: "Keine Vorgänge zu diesen Filtern.",
    selectedOffer: "Ausgewähltes Angebot",
    noOfferSelected: "Es wurde noch kein Angebot ausgewählt.",
    noDecision: "Für diesen Vorgang liegt noch keine Bewertung vor.",
    detailTitle: "Vorgang {reference}",
    tabs: {
      overview: "Übersicht",
      decision: "Entscheidung",
      documents: "Unterlagen",
      timeline: "Verlauf",
      consents: "Einwilligungen",
      notes: "Notizen",
    },
    decisionTitle: "Automatische Bewertung",
    decisionScore: "Punktzahl",
    decisionGrade: "Einstufung",
    decisionRuleSet: "Regelwerk",
    firedRules: "Ausgelöste Regeln",
    factsTitle: "Bewertete Eingaben",
    grantedAmount: "Bewilligter Betrag",
    grantedAmountHint: "Leer lassen, um den beantragten Betrag zu bewilligen.",
    approveAndIssueContract: "Bewilligen und Vertrag erstellen",
    returnReason: "Was soll die Kundin oder der Kunde nachbessern?",
    returnReasonHint: "Pflichtangabe. Dieser Text wird der Kundin oder dem Kunden angezeigt.",
    returnToCustomer: "Zur Nachbesserung zurückgeben",
    schufaRequested: "SCHUFA-Auskunft gewünscht",
    bankDetails: "Bankverbindung",
    accountFee: "Kontogebühr",
    outcome: { ACCEPT: "Zusage", REFER: "Manuelle Prüfung", DECLINE: "Absage" },
    overrideReason: "Begründung",
    overrideReasonHint: "Pflichtangabe. Wird dauerhaft im Prüfpfad gespeichert.",
    reviewDocument: "Unterlage prüfen",
    approveDocument: "Annehmen",
    rejectDocument: "Ablehnen",
    requestMore: "Weitere Unterlagen anfordern",
    confirmFee: "Zahlungseingang bestätigen",
    confirmFeeIntro:
      "Die Gebühr wird nicht auf der Website bezahlt, sondern direkt mit uns. Erst klicken, wenn das Geld tatsächlich eingegangen ist — danach geht der Vorgang in die Auszahlung.",
    confirmFeeAmount: "Offener Betrag:",
    confirmFeeReference: "Zahlungsreferenz:",
    confirmFeeDone: "Zahlungseingang vermerkt. Der Vorgang steht jetzt zur Auszahlung bereit.",
    disburse: "Auszahlung abgeschlossen",
    payoutAccount: "Auszahlungskonto:",
    payoutAccountMissing: "Kein Konto im Vorgang",
    disburseIntro:
      "Erst klicken, wenn die Überweisung tatsächlich raus ist. Der Vorgang gilt dann als ausgezahlt und das Warten endet für die darlehensnehmende Person.",
    disburseDone: "Auszahlung vermerkt. Die darlehensnehmende Person wird benachrichtigt.",
    openDocument: "Öffnen",
    contactTitle: "Kontakt und Anschrift",
    employmentTitle: "Beschäftigung und Einkommen",
    householdTitle: "Haushalt",
    bankTitle: "Bankverbindung",
    coBorrowerTitle: "Zweite kreditnehmende Person",
    ibanFull: "IBAN (vollständig)",
    ibanMissing: "Noch keine IBAN im Vorgang.",
    outstandingDocuments: "Noch nicht freigegeben:",
    deleteTitle: "Vorgang löschen",
    deleteIntro:
      "Löscht den Vorgang mit allen Unterlagen, Verträgen, Entscheidungen und dem Prüfpfad. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Diesen Vorgang endgültig löschen?",
    delete: "Endgültig löschen",
    timelineEmpty: "Noch keine Ereignisse.",
    auditIntact: "Prüfpfad unversehrt ({count} Einträge).",
    auditBroken: "Achtung: Der Prüfpfad ist ab Eintrag {sequence} nicht mehr schlüssig.",
    rulesTitle: "Regelwerke",
    rulesIntro:
      "Ein veröffentlichtes Regelwerk wird nie geändert. Änderungen erzeugen eine neue Version, damit jede vergangene Entscheidung nachvollziehbar bleibt.",
    ruleSetStatus: { DRAFT: "Entwurf", PUBLISHED: "Veröffentlicht", ARCHIVED: "Archiviert" },
    publish: "Veröffentlichen",
    newVersion: "Neue Version anlegen",
    lendersTitle: "Partnerbanken",
    lenderActive: "Aktiv",
    lenderInactive: "Inaktiv",
    accountSpaceTitle: "Bankverbindung im Kundenkonto",
    accountSpaceIntro:
      "Diese Angaben erscheinen in Schritt 5 im Kontobereich jeder Kundin und jedes Kunden, auf der Karte und unter dem verfügbaren Betrag. Kartennummer und IBAN dienen als Grundlage: jede Kundin und jeder Kunde bekommt eigene, die sich danach nicht mehr ändern. Solange nichts gespeichert ist, werden die Vorgabewerte angezeigt.",
    accountSpaceFields: {
      bankName: "Bank",
      accountHolder: "Kontoinhaber",
      iban: "IBAN",
      bic: "BIC",
      cardNumber: "Kartennummer",
      cardExpiry: "Gültig bis (MM/JJ)",
    },
    accountHolderHint: "Leer lassen, um den Namen der Kundin oder des Kunden anzuzeigen.",
    cardNumberHint:
      "Jede Kundin und jeder Kunde erhält eine eigene Kartennummer mit denselben ersten sechs Ziffern. Im Kundenkonto werden nur die letzten vier gezeigt.",
    ibanHint: "Jede Kundin und jeder Kunde erhält eine eigene IBAN bei derselben Bankleitzahl.",
    accountSpaceSave: "Bankverbindung speichern",
    accountSpaceSaved: "Gespeichert. Das Kundenkonto zeigt ab sofort diese Angaben.",
    accountSpaceInvalid: "Bitte alle Felder außer dem Kontoinhaber ausfüllen; das Ablaufdatum als MM/JJ.",
    transferTitle: "Überweisung aus dem Kundenkonto",
    transferCode: "Bestätigungscode:",
    transferCodeIntro:
      "Die Kundin oder der Kunde fragt diesen Code per E-Mail an, um die Überweisung in Schritt 5 freizugeben.",
    transferRequested: "Überweisung beauftragt am {date}.",
    transferNotRequested: "Noch keine Überweisung beauftragt.",
    transferAttempts: "Falsche Eingaben: {count} von {max}.",
    transferLocked: "Gesperrt nach zu vielen falschen Codes.",
    transferReset: "Sperre aufheben",
    clientAccountTitle: "Kartennummer und IBAN dieser Kundin oder dieses Kunden",
    clientAccountIntro: "So erscheinen sie im Kontobereich in Schritt 5. Hier lassen sie sich für diesen Vorgang ändern.",
    clientAccountSave: "Speichern",
    clientAccountSaved: "Gespeichert. Der Kontobereich zeigt ab sofort diese Angaben.",
    clientCardInvalid: "Die Kartennummer muss 12 bis 19 Ziffern haben.",
    kpiTitle: "Kennzahlen",
    kpi: {
      simulations: "Berechnungen",
      eligibilityRequests: "Konditionsanfragen",
      submitted: "Verbindliche Anfragen",
      approved: "Zusagen",
      disbursed: "Auszahlungen",
      manualReviewRate: "Anteil manueller Prüfung",
      documentRejectRate: "Ablehnquote Unterlagen",
      bankCheckFailureRate: "Fehlerquote Kontoblick",
      medianDecisionMinutes: "Mittlere Entscheidungsdauer (Minuten)",
      integrationFailures: "Fehlgeschlagene Integrationsaufrufe",
    },
  },

  notification: {
    admin_setup_code: {
      subject: "Bestätigungscode für ein neues Administratorkonto: {code}",
      body: `Jemand möchte ein Administratorkonto für Eichen anlegen.

Name       {name}
E-Mail     {email}

Bestätigungscode: {code}

Der Code gilt {minutes} Minuten. Geben Sie ihn nur weiter, wenn Sie dieses Konto tatsächlich freischalten wollen — mit ihm erhält die Person vollen Zugang zum Backoffice. Wenn Sie diese Anfrage nicht erwarten, ignorieren Sie diese Nachricht; ohne den Code passiert nichts.`,
    },
    application_incomplete: {
      subject: "Ihre Kreditanfrage ist noch nicht abgeschlossen",
      body: "Ihre Anfrage {reference} wartet noch auf Ihre Angaben. Sie können dort weitermachen, wo Sie aufgehört haben.",
    },
    application_submitted: {
      subject: "Ihr Antrag ist eingegangen",
      body: "Wir haben Ihren Antrag {reference} erhalten. Eine Mitarbeiterin oder ein Mitarbeiter sieht ihn sich an und meldet sich in der Regel binnen eines Werktages.",
    },
    account_fee_due: {
      subject: "Die Kontogebühr ist offen",
      body: "Für Ihren Antrag {reference} ist die einmalige Kontogebühr fällig. Zahlungsreferenz {feeReference}. Danach bereiten wir die Auszahlung vor.",
    },
    contract_signed_ops: {
      subject: "Vertrag unterschrieben — {reference} — {borrower}",
      body: `{borrower} hat den Vertrag zu Antrag {reference} am {signedAt} unterschrieben. Die Kontogebühr wurde ausgestellt; nach ihrem Eingang steht die Auszahlung an. Eine Antwort auf diese Nachricht geht an die darlehensnehmende Person.

ANTRAGSTELLERIN ODER ANTRAGSTELLER
Name             {borrower}
Geburtsdatum     {birthDate}
E-Mail           {email}
Telefon          {phone}
Anschrift        {address}
Beschäftigung    {employment}
Arbeitgeber      {employer}
Nettoeinkommen   {income} monatlich
Sonst. Einkünfte {otherIncome} monatlich

VERTRAG
Vorgangsnummer   {reference}
Verwendungszweck {purpose}
Nettodarlehen    {amount}
Laufzeit         {term} Monate
Monatliche Rate  {instalment}
Sollzins         {nominalRate}
Effektivzins     {effectiveRate}
Gesamtbetrag     {totalPayable}
Restschuldvers.  {insurance}
Auszahlungskonto {bank} {maskedIban}
Widerrufsfrist   bis {withdrawalUntil}

NACHWEIS
Dokument         {documentHash}
Unterschrift     {signatureHash}`,
    },
    decision_ready: {
      subject: "Es gibt ein Ergebnis zu Ihrer Anfrage",
      body: "Zu Ihrer Anfrage {reference} liegt ein Ergebnis vor. Melden Sie sich an, um es zu sehen.",
    },
    documents_required: {
      subject: "Wir brauchen noch Unterlagen",
      body: "Für Ihre Anfrage {reference} fehlen uns noch Unterlagen.",
    },
    contract_ready: {
      subject: "Ihr Vertrag liegt zur Unterschrift bereit",
      body: "Der Vertrag zu Ihrer Anfrage {reference} kann jetzt unterschrieben werden.",
    },
    disbursed: {
      subject: "Ihr Kredit wurde ausgezahlt",
      body: "Der Betrag zu Ihrem Kredit {reference} ist angewiesen.",
    },
    instalment_due: {
      subject: "Ihre nächste Rate",
      body: "Die nächste Rate Ihres Kredits {reference} ist am {date} fällig.",
    },
    payment_failed: {
      subject: "Eine Zahlung konnte nicht eingezogen werden",
      body: "Zu Ihrem Kredit {reference} konnte eine Rate nicht eingezogen werden. Bitte melden Sie sich an.",
    },
  },

  contact: {
    title: "Fragen zu Ihrem Antrag?",
    body: "Schreiben Sie uns. Wir antworten an Werktagen meist innerhalb weniger Stunden.",
    waitingBody:
      "Sie müssen nicht warten, ohne zu wissen, woran Sie sind. Fragen Sie uns jederzeit nach dem Stand Ihres Antrags.",
    feeBody: "Wenn etwas an der Gebühr unklar ist, fragen Sie uns, bevor Sie bezahlen.",
    whatsapp: "Per WhatsApp",
    email: "Per E-Mail",
    subject: "Meine Kreditanfrage",
  },

  fee: {
    title: "Einmalige Kontogebühr",
    intro:
      "Für die Einrichtung und Führung Ihres Kreditkontos berechnen wir eine einmalige Gebühr. Sie wird vor der Auszahlung fällig.",
    amountDue: "Zu zahlen",
    basis: "Berechnung",
    basisValue: "{rate} von {amount}",
    reference: "Zahlungsreferenz",
    dueBy: "Zahlbar bis",
    bounds: "Mindest- und Höchstbetrag",
    boundsValue: "mindestens {min}, höchstens {max}",
    onceTitle: "Einmalig, nicht monatlich",
    onceBody:
      "Diese Gebühr fällt genau einmal an. Sie ist in Ihren monatlichen Raten nicht enthalten und wird nicht erneut erhoben.",
    contactTitle: "So bezahlen Sie die Gebühr",
    contactIntro:
      "Die Zahlung stimmen wir persönlich mit Ihnen ab. Melden Sie sich über WhatsApp oder per E-Mail bei uns — wir nennen Ihnen die Zahlungsmöglichkeiten und bestätigen Ihnen den Eingang. Danach bereiten wir die Auszahlung vor.",
    contactReference: "Bitte nennen Sie dabei Ihre Zahlungsreferenz {reference}.",
    cardTitle: "Mit Karte bezahlen",
    cardIntro:
      "Sofortige Zahlung mit Ihrer Debit- oder Kreditkarte. Sobald die Karte akzeptiert ist, bereiten wir die Auszahlung vor.",
    cardNumber: "Kartennummer",
    cardHolder: "Name der Karteninhaberin oder des Karteninhabers",
    cardExpiry: "Gültig bis",
    cardExpiryHint: "MM/JJ, wie auf der Karte aufgedruckt",
    cardCvc: "Prüfziffer",
    cardCvcHint: "Die drei Ziffern auf der Rückseite der Karte",
    cardSecurity:
      "Ihre Kartendaten gehen an unseren Zahlungsdienstleister und werden nicht gespeichert. Wir behalten nur das Kartennetz und die letzten vier Ziffern für Ihren Beleg.",
    cardErrors: {
      cardNumberInvalid: "Diese Kartennummer ist unvollständig oder enthält einen Tippfehler.",
      cardHolderInvalid: "Bitte geben Sie den Namen so ein, wie er auf der Karte steht.",
      cardExpired: "Diese Karte ist abgelaufen. Bitte verwenden Sie eine andere.",
      cardExpiryInvalid: "Bitte geben Sie das Ablaufdatum als MM/JJ an.",
      cardCvcInvalid: "Die Prüfziffer hat drei Stellen (bei American Express vier).",
    },
    cardOnFile: "{brand}-Karte mit den Endziffern {last4}",
    manualOnFile: "Direkt mit unserem Team abgestimmt",
    declinedTitle: "Die Zahlung wurde nicht ausgeführt",
    declinedBody:
      "Ihre Bank hat die Zahlung abgelehnt. Es wurde nichts abgebucht. Versuchen Sie es erneut oder verwenden Sie eine andere Karte.",
    expired: "Diese Zahlungsaufforderung ist abgelaufen. Bitte melden Sie sich bei uns.",
    submit: "Jetzt bezahlen",
    submitHint: "Danach bereiten wir die Auszahlung vor.",
  },

  legal: {
    imprint: "Impressum",
    privacy: "Datenschutz",
    terms: "AGB",
    cookies: "Cookies",
    complaints: "Beschwerden",
    esis: "Europäische Standardinformationen",
    disclaimerTitle: "Rechtlicher Hinweis",
    disclaimer:
      "Eichen ist ein Demonstrationsprojekt. Konditionen, Entscheidungen und Kundenstimmen sind erfunden, es kommt kein Kreditvertrag zustande, es fließt kein Geld und es findet keine echte Auskunftei-, Konto- oder Identitätsprüfung statt.",
    dataRights:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie auf Widerspruch und Datenübertragbarkeit.",
    supervisory: "Zuständige Aufsichtsbehörde: Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin).",
  },

  errors: {
    generic: "Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.",
    notFound: "Diese Seite gibt es nicht.",
    unauthorised: "Bitte melden Sie sich an.",
    forbidden: "Dafür fehlt Ihnen die Berechtigung.",
    validation: "Bitte prüfen Sie die markierten Felder.",
    amountRange: "Der Betrag muss zwischen {min} und {max} liegen.",
    termRange: "Die Laufzeit muss zwischen {min} und {max} Monaten liegen.",
    required: "Dieses Feld wird benötigt.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
    invalidDate: "Bitte geben Sie ein gültiges Datum an.",
    invalidPhone: "Bitte geben Sie eine gültige Mobilnummer an.",
    consentRequired: "Ohne diese Einwilligung können wir den Schritt nicht ausführen.",
    ibanInvalid: "Diese IBAN stimmt nicht. Bitte prüfen Sie die Ziffern.",
    notEligibleTitle: "Dieser Antrag ist so nicht möglich",
    notEligible:
      "Ihre Angaben passen nicht zu den Bedingungen unseres Angebots — etwa Laufzeit, Verwendungszweck oder Beschäftigung. Bitte prüfen Sie sie im ersten Schritt.",
    fileTooLarge: "Die Datei ist größer als 10 MB.",
    fileType: "Erlaubt sind PDF, JPG und PNG.",
    stateConflict: "Dieser Schritt passt nicht zum aktuellen Stand des Vorgangs.",
    providerUnavailable: "Ein Dienst ist gerade nicht erreichbar. Wir zeigen Ihnen einen anderen Weg.",
    rateLimited: "Zu viele Versuche. Bitte warten Sie einen Moment.",
    transferCodeInvalid: "Dieser Code stimmt nicht. Bitte prüfen Sie die sechs Ziffern.",
    transferCodeLocked:
      "Zu viele falsche Codes. Die Überweisung ist gesperrt — bitte schreiben Sie uns, wir geben sie wieder frei.",
  },
  footer: {
    tagline: "Ein Kredit mit klaren Zahlen: 3 % fester Sollzins, Rate und Gesamtkosten stehen fest, bevor Sie sich entscheiden.",
    columnCredit: "Kredit",
    columnCompany: "Unternehmen",
    columnLegal: "Rechtliches",
    linkAutokredit: "Autokredit",
    linkUmschuldung: "Umschuldung",
    linkKonditionen: "Konditionen",
    linkHowItWorks: "So funktioniert es",
    linkFaq: "Häufige Fragen",
    linkPartners: "Partnerbanken",
    linkContact: "Kontakt",
  },
} as const;

/**
 * Widens the literal types produced by `as const` down to `string`, so that
 * `fr` is checked for having exactly the same keys without being forced to
 * repeat the German wording.
 */
type Translated<T> = T extends string ? string : { [K in keyof T]: Translated<T[K]> };

export type Dictionary = Translated<typeof de>;
