/** Factual layout-31 record ordering derived for interoperability; no vendor code. */
export type SavFieldSpec = readonly [name: string, type: number, dimension: number, predicate: number, minimumRevision: number];
export const SAV_LAYOUT_31: readonly SavFieldSpec[] = [
  ["Info", 3, 36, 0, 0],
  ["Release", 0, 1, 0, 30],
  ["Pntrev", 0, 0, 0, 30],
  ["Headre", 1, 0, 0, 29],
  ["Headin", 0, 0, 0, 31],
  ["Maxary", 0, 0, 0, 19],
  ["Headlo", 4, 0, 0, 30],
  ["Ihanb", 3, 120, 0, 0],
  ["Title", 3, 1152, 0, 0],
  ["Numbus", 0, -1, 0, 0],
  ["Jcode", 0, -1, 0, 0],
  ["Volt", 5, -1, 44, 30],
  ["Dblvlt", 6, -1, 14, 30],
  ["Nvlmhi", 1, -1, 0, 28],
  ["Evlmlo", 1, -1, 0, 28],
  ["Evlmhi", 1, -1, 0, 28],
  ["Nvlmlo", 1, -1, 0, 28],
  ["Bsectns", 0, -1, 0, 29],
  ["Sectnum", 0, -1, 36, 30],
  ["Origbus", 0, -1, 0, 29],
  ["Ldfrst", 0, -1, 1, 16],
  ["Ldnext", 0, -19, 1, 16],
  ["Cfdlfr", 5, -21, 1, 16],
  ["Ldstat", 0, -19, 1, 16],
  ["Ldarea", 0, -19, 1, 16],
  ["Ldzone", 0, -19, 1, 16],
  ["Ldownr", 0, -19, 1, 18],
  ["Loadid", 3, -20, 1, 16],
  ["Ldconf", 3, -19, 1, 27],
  ["Ldintr", 3, -19, 1, 28],
  ["Cdgnfr", 5, -19, 1, 29],
  ["Ldgnfl", 0, -19, 1, 29],
  ["Ildtype", 0, -19, 1, 31],
  ["Ldname", 3, -131, 1, 31],
  ["Ldnmord", 0, -19, 1, 31],
  ["Shfrst", 0, -1, 29, 26],
  ["Shnext", 0, -83, 29, 26],
  ["Shstat", 0, -83, 29, 26],
  ["Shntgb", 5, -83, 29, 26],
  ["Shntid", 3, -84, 29, 26],
  ["Shnnam", 3, -140, 29, 31],
  ["Shnmord", 0, -83, 29, 31],
  ["Busnam", 3, -74, 0, 24],
  ["Basvlt", 1, -1, 0, 0],
  ["Iarea", 0, -1, 0, 0],
  ["Loszon", 0, -1, 0, 0],
  ["Iowner", 0, -1, 0, 18],
  ["Busord", 0, -1, 0, 0],
  ["Alford", 0, -1, 0, 0],
  ["Ordalf", 0, -1, 0, 0],
  ["Busext", 0, -1, 0, 0],
  ["Busint", 0, -1, 0, 0],
  ["Bslist", 0, -1, 2, 0],
  ["Bsthrd", 0, -1, 2, 0],
  ["Genbus", 0, -1, 0, 0],
  ["Pgen", 1, -4, 0, 0],
  ["Qgen", 1, -4, 0, 0],
  ["Qmax", 1, -4, 0, 0],
  ["Qmin", 1, -4, 0, 0],
  ["Vsave", 1, -4, 0, 0],
  ["Regbus", 0, -4, 0, 0],
  ["Regnod", 0, -4, 0, 30],
  ["Rempct", 1, -4, 0, 0],
  ["Mcfrst", 0, -4, 0, 0],
  ["Mcnext", 0, -5, 0, 0],
  ["Mxstat", 0, -5, 0, 0],
  ["Pgenmc", 1, -5, 0, 0],
  ["Qgenmc", 1, -5, 0, 0],
  ["Qmaxmc", 1, -5, 0, 0],
  ["Qminmc", 1, -5, 0, 0],
  ["Mbase", 1, -5, 0, 0],
  ["Zsorce", 5, -5, 0, 0],
  ["Xtran", 5, -5, 0, 0],
  ["Gentap", 1, -5, 0, 0],
  ["Isorce", 5, -5, 0, 0],
  ["Machid", 3, -6, 0, 18],
  ["Pmaxmc", 1, -5, 0, 0],
  ["Pminmc", 1, -5, 0, 0],
  ["Mcofst", 0, -5, 0, 18],
  ["Mconxt", 0, -27, 0, 18],
  ["Mconum", 0, -27, 0, 18],
  ["Mcopct", 1, -27, 0, 18],
  ["Basflg", 0, -5, 0, 30],
  ["Wndnum", 0, -5, 30, 26],
  ["Wndmod", 0, -85, 30, 26],
  ["Wndpf", 1, -85, 30, 26],
  ["Mcname", 3, -133, 0, 31],
  ["Mcnmord", 0, -5, 0, 31],
  ["Imfrst", 0, -1, 31, 28],
  ["Imnext", 0, -90, 31, 28],
  ["Imbits", 0, -90, 31, 28],
  ["Imarea", 0, -90, 31, 28],
  ["Imzone", 0, -90, 31, 28],
  ["Imwonr", 1, -90, 31, 28],
  ["Imbase", 1, -90, 31, 28],
  ["Imratv", 1, -90, 31, 28],
  ["Imsetp", 1, -90, 31, 28],
  ["Imra", 1, -90, 31, 28],
  ["Imxa", 1, -90, 31, 28],
  ["Imxm", 1, -90, 31, 28],
  ["Imr1", 1, -90, 31, 28],
  ["Imx1", 1, -90, 31, 28],
  ["Imr2", 1, -90, 31, 28],
  ["Imx2", 1, -90, 31, 28],
  ["Imx3", 1, -90, 31, 28],
  ["Ime1", 1, -90, 31, 28],
  ["Imse1", 1, -90, 31, 28],
  ["Ime2", 1, -90, 31, 28],
  ["Imse2", 1, -90, 31, 28],
  ["Imia1", 1, -90, 31, 28],
  ["Imia2", 1, -90, 31, 28],
  ["Immult", 1, -90, 31, 28],
  ["Imtrqa", 1, -90, 31, 28],
  ["Imtrqb", 1, -90, 31, 28],
  ["Imtrqd", 1, -90, 31, 28],
  ["Imtrqe", 1, -90, 31, 28],
  ["Imh", 1, -90, 31, 28],
  ["Impac", 1, -90, 31, 28],
  ["Imqac", 1, -90, 31, 28],
  ["Imslip", 1, -90, 31, 28],
  ["Imzsrc", 5, -90, 31, 28],
  ["Imisrc", 5, -90, 31, 28],
  ["Imacid", 3, -91, 31, 28],
  ["Imname", 3, -132, 31, 31],
  ["Immnord", 0, -90, 31, 31],
  ["Swdratnam", 3, -99, 0, 31],
  ["Swdrattyp", 0, -141, 0, 31],
  ["Swdratunt", 3, -135, 0, 31],
  ["Swdratdesc", 3, -100, 0, 31],
  ["Rsetname", 3, -138, 48, 31],
  ["Swdrate", 1, -137, 48, 31],
  ["Rsetdesc", 3, -139, 48, 31],
  ["Swdrattblord", 0, -136, 48, 31],
  ["Ifirst", 0, -1, 0, 0],
  ["Ito", 0, -7, 0, 0],
  ["Inext", 0, -7, 0, 0],
  ["Icom", 0, -7, 0, 0],
  ["Bypass", 0, -7, 0, 31],
  ["Numckt", 3, -8, 0, 0],
  ["Kfirst", 0, -1, 0, 0],
  ["Kto", 0, -8, 0, 0],
  ["Knext", 0, -8, 0, 0],
  ["Knum", 0, -8, 0, 0],
  ["Gb", 5, -7, 0, 0],
  ["B2s", 1, -7, 0, 0],
  ["Gbline", 5, -8, 0, 0],
  ["Imeter", 0, -7, 0, 0],
  ["Brname", 3, -98, 0, 29],
  ["Bnmord", 0, -7, 0, 29],
  ["Ratnam", 3, -99, 0, 29],
  ["Ratdesc", 3, -100, 0, 29],
  ["Ratselector", 0, 1, 0, 29],
  ["Ratings", 1, -101, 0, 29],
  ["Linlen", 1, -7, 0, 16],
  ["Lnofst", 0, -7, 0, 18],
  ["Lnonxt", 0, -28, 0, 18],
  ["Lnonum", 0, -28, 0, 18],
  ["Lnopct", 1, -28, 0, 18],
  ["Tapno", 0, -7, 0, 0],
  ["Iocode", 0, -9, 0, 21],
  ["Windrp", 1, -9, 0, 21],
  ["Windrs", 1, -9, 0, 21],
  ["Psangl", 1, -9, 0, 21],
  ["Nomvp", 1, -9, 0, 21],
  ["Nomvs", 1, -9, 0, 21],
  ["Trnbas", 1, -9, 0, 21],
  ["Trname", 3, 1, 36, 29],
  ["Tablno", 0, -9, 0, 0],
  ["Ntbpnt", 0, -26, 43, 29],
  ["Phshtb", 4, -26, 43, 29],
  ["ZCorTbl%T", 1, -117, 43, 29],
  ["ZCorTbl%F", 5, -117, 43, 29],
  ["Gbtran", 5, -9, 0, 0],
  ["Tpnabl", 0, -9, 0, 9],
  ["Pqcont", 0, -9, 0, 0],
  ["Pqcnod", 0, -9, 0, 30],
  ["Vmax", 1, -9, 0, 0],
  ["Vmin", 1, -9, 0, 0],
  ["Rmax", 1, -9, 0, 0],
  ["Rmin", 1, -9, 0, 0],
  ["Psalfa", 1, -9, 0, 27],
  ["Ntapos", 0, -9, 0, 21],
  ["Xfrcmp", 5, -9, 0, 14],
  ["Vg2idx", 0, -9, 0, 28],
  ["Indx3w", 0, -9, 45, 30],
  ["Bus3wt", 0, -51, 45, 21],
  ["Icm3wt", 0, -49, 45, 21],
  ["Nmtr3w", 0, -49, 45, 21],
  ["Ckt3wt", 3, -50, 45, 21],
  ["Nam3wt", 3, -118, 45, 29],
  ["Vg3idx", 0, -49, 45, 28],
  ["Vg3nam", 3, -124, 45, 30],
  ["Fcstat", 0, -43, 3, 19],
  ["Vmxmod", 0, -43, 3, 19],
  ["Fcsbus", 0, -43, 3, 19],
  ["Fctbus", 0, -43, 3, 19],
  ["Fcownr", 0, -43, 3, 19],
  ["Fcrem", 0, -43, 3, 26],
  ["Fcordr", 0, -43, 3, 26],
  ["Fcnode", 0, -43, 3, 30],
  ["Fpbrdg", 1, -43, 3, 19],
  ["Fqshnt", 1, -43, 3, 19],
  ["Fpsend", 1, -43, 3, 19],
  ["Fqsend", 1, -43, 3, 19],
  ["Fpterm", 1, -43, 3, 19],
  ["Fqterm", 1, -43, 3, 19],
  ["Fcacc", 1, -43, 3, 19],
  ["Oldlta", 1, -43, 3, 19],
  ["Olderr", 1, -43, 3, 19],
  ["Fcpdes", 1, -43, 3, 19],
  ["Fcqdes", 1, -43, 3, 19],
  ["Fcvset", 1, -43, 3, 19],
  ["Fcvtmx", 1, -43, 3, 19],
  ["Fcvtmn", 1, -43, 3, 19],
  ["Trsfmx", 1, -43, 3, 19],
  ["Fcshmx", 1, -43, 3, 19],
  ["Fcvmx", 1, -43, 3, 19],
  ["Fcimx", 1, -43, 3, 19],
  ["Bseres", 1, -43, 3, 19],
  ["Fcpct", 1, -43, 3, 24],
  ["Fcname", 3, -86, 3, 26],
  ["Fcipnm", 3, -86, 3, 26],
  ["Ipr", 0, -31, 4, 18],
  ["Ipi", 0, -31, 4, 18],
  ["Mdc", 0, -31, 4, 18],
  ["Nbr", 0, -31, 4, 18],
  ["Nbi", 0, -31, 4, 18],
  ["Dcmetr", 0, -31, 4, 18],
  ["Combsr", 0, -31, 4, 18],
  ["Combsi", 0, -31, 4, 18],
  ["Comndr", 0, -31, 4, 30],
  ["Comndi", 0, -31, 4, 30],
  ["Acfrr", 0, -31, 4, 18],
  ["Actor", 0, -31, 4, 18],
  ["Acfri", 0, -31, 4, 18],
  ["Actoi", 0, -31, 4, 18],
  ["Cccitmax", 0, -31, 4, 19],
  ["Dc2ord", 0, -31, 4, 26],
  ["Pacr", 1, -31, 4, 18],
  ["Qacr", 1, -31, 4, 18],
  ["Paci", 1, -31, 4, 18],
  ["Qaci", 1, -31, 4, 18],
  ["Alfa", 1, -31, 4, 18],
  ["Gama", 1, -31, 4, 18],
  ["Tapr", 1, -31, 4, 18],
  ["Tapi", 1, -31, 4, 18],
  ["Vdcr", 1, -31, 4, 18],
  ["Vdci", 1, -31, 4, 18],
  ["Dc", 1, -31, 4, 18],
  ["Setval", 1, -31, 4, 18],
  ["Rdc", 1, -31, 4, 18],
  ["Rcomp", 1, -31, 4, 18],
  ["Vsched", 1, -31, 4, 18],
  ["Vcmode", 1, -31, 4, 18],
  ["Delti", 1, -31, 4, 18],
  ["Alfmin", 1, -31, 4, 18],
  ["Alfmx", 1, -31, 4, 18],
  ["Gammin", 1, -31, 4, 18],
  ["Gammx", 1, -31, 4, 18],
  ["Xcrr", 1, -31, 4, 18],
  ["Xcir", 1, -31, 4, 18],
  ["Ebaser", 1, -31, 4, 18],
  ["Ebasei", 1, -31, 4, 18],
  ["Trr", 1, -31, 4, 18],
  ["Tri", 1, -31, 4, 18],
  ["Tapmxr", 1, -31, 4, 18],
  ["Tapmnr", 1, -31, 4, 18],
  ["Tstpr", 1, -31, 4, 18],
  ["Tapmxi", 1, -31, 4, 18],
  ["Tapmni", 1, -31, 4, 18],
  ["Tstpi", 1, -31, 4, 18],
  ["Rcr", 1, -31, 4, 18],
  ["Rci", 1, -31, 4, 18],
  ["Dcvmin", 1, -31, 4, 18],
  ["Xcapr", 1, -31, 4, 19],
  ["Xcapi", 1, -31, 4, 19],
  ["Cccacc", 1, -31, 4, 19],
  ["Acidr", 3, -32, 4, 17],
  ["Acidi", 3, -32, 4, 17],
  ["Dc2nam", 3, -45, 4, 26],
  ["Vscmdc,...", 0, -71, 28, 23],
  ["Vscidc,...", 1, -71, 28, 23],
  ["Vscnam", 3, -81, 28, 24],
  ["Vsccnv,...", 0, -130, 28, 30],
  ["Vscpac,...", 1, -73, 28, 23],
  ["Nconv,...", 0, -87, 5, 26],
  ["Dcmswv", 1, -33, 5, 18],
  ["Mdcnam", 3, -88, 5, 26],
  ["Pac,...", 1, -35, 5, 18],
  ["Acbus,...", 0, -36, 5, 18],
  ["Vdc,...", 1, -37, 5, 18],
  ["Dcarea,...", 0, -38, 5, 18],
  ["Dcname", 3, -77, 5, 24],
  ["Dcres,...", 1, -40, 5, 18],
  ["Dcfr,...", 0, -41, 5, 18],
  ["Dcckt", 3, -42, 5, 0],
  ["Swfrst", 0, -1, 6, 0],
  ["Swnext", 0, -10, 6, 30],
  ["Swshid", 3, -125, 6, 30],
  ["Swshmd", 0, -10, 6, 0],
  ["Bswich", 1, -10, 6, 0],
  ["Vshnhi", 1, -10, 6, 0],
  ["Vshnlo", 1, -10, 6, 0],
  ["Swshrm", 0, -10, 6, 0],
  ["Swsnod", 0, -10, 6, 30],
  ["Swspct", 1, -10, 6, 24],
  ["Rmindx", 0, -10, 6, 23],
  ["Nswstp", 0, -11, 6, 0],
  ["Swshnb", 1, -11, 6, 0],
  ["Swshnm", 3, -134, 6, 31],
  ["Shswmord", 0, -10, 6, 31],
  ["Bswicz", 1, -10, 13, 13],
  ["Swshnz", 1, -11, 13, 13],
  ["Areord", 0, -22, 0, 27],
  ["Numare", 0, -22, 0, 27],
  ["Ownord", 0, -29, 0, 27],
  ["Numown", 0, -29, 0, 27],
  ["Zonord", 0, -24, 0, 27],
  ["Numzon", 0, -24, 0, 27],
  ["Iswing", 0, -22, 0, 0],
  ["Desint", 1, -22, 0, 17],
  ["Destol", 1, -22, 0, 17],
  ["Arnam", 3, -78, 0, 24],
  ["Zoname", 3, -79, 0, 24],
  ["Owname", 3, -80, 0, 24],
  ["Inarea", 0, -22, 0, 18],
  ["Inzone", 0, -24, 0, 18],
  ["Inownr", 0, -29, 0, 18],
  ["Zernum", 0, -7, 2, 0],
  ["Zflow", 5, -12, 2, 0],
  ["Mulbus", 0, -1, 7, 11],
  ["Mulsec", 0, -7, 7, 11],
  ["Msfrom", 0, -15, 7, 11],
  ["Msto", 0, -15, 7, 11],
  ["Msfrst", 0, -15, 7, 11],
  ["Mslast", 0, -15, 7, 11],
  ["Sectto", 0, -16, 7, 11],
  ["Sectkf", 0, -16, 7, 11],
  ["Mslnid", 3, -15, 7, 11],
  ["Secckt", 3, -17, 7, 11],
  ["Msmetr", 0, -15, 7, 12],
  ["Arfrom", 0, -18, 8, 13],
  ["Arto", 0, -18, 8, 13],
  ["Ptran", 1, -18, 8, 13],
  ["Tranid", 3, -18, 8, 13],
  ["Vdname", 3, -143, 49, 31],
  ["Vdorder", 0, -142, 49, 31],
  ["Vdqdb", 1, -142, 49, 31],
  ["Vdqmaxraw", 1, -142, 49, 31],
  ["Vdqminraw", 1, -142, 49, 31],
  ["Vdvlowraw", 1, -142, 49, 31],
  ["Vddbloraw", 1, -142, 49, 31],
  ["Vddbhiraw", 1, -142, 49, 31],
  ["Vdvhiraw", 1, -142, 49, 31],
  ["Vdstatusraw", 0, -142, 49, 31],
  ["Vdregbus", 0, -142, 49, 31],
  ["Machdrpcurve", 0, -5, 0, 31],
  ["Ldtypename", 3, -145, 50, 31],
  ["Ldtypedes", 3, -146, 50, 31],
  ["Inldtype", 0, -144, 50, 31],
  ["Ldtypeord", 0, -144, 50, 31],
  ["Intername", 3, -149, 51, 31],
  ["Internumber", 0, -147, 51, 31],
  ["Intertype", 0, -147, 51, 31],
  ["Internameord", 0, -147, 51, 31],
  ["Internmbrord", 0, -147, 51, 31],
  ["Interfirst", 0, -147, 51, 31],
  ["Interratemax", 0, -148, 51, 31],
  ["Interratemin", 0, -148, 51, 31],
  ["Internext", 0, -150, 52, 31],
  ["Inteletype", 0, -150, 52, 31],
  ["Intelekf", 0, -150, 52, 31],
  ["Inteletoarea", 0, -150, 52, 31],
  ["Inteledirect", 0, -150, 52, 31],
  ["Intelemeter", 0, -150, 52, 31],
  ["Inteleweight", 1, -150, 52, 31],
  ["Grpos", 1, -5, 10, 28],
  ["Gxsubt", 1, -5, 10, 28],
  ["Gxtrns", 1, -5, 10, 28],
  ["Gxsync", 1, -5, 10, 28],
  ["Zsneg", 5, -5, 10, 0],
  ["Zszero", 5, -5, 10, 0],
  ["Gxgrnd", 5, -5, 10, 28],
  ["Ggrcod", 3, -5, 10, 28],
  ["Grfdeg", 1, -5, 10, 29],
  ["Loadn", 5, -19, 10, 28],
  ["Loadz", 5, -19, 10, 28],
  ["Lgrcod", 3, -19, 10, 28],
  ["Shntzr", 5, -83, 10, 26],
  ["Cnxcod", 0, -9, 10, 0],
  ["Zgrnd0", 5, -82, 10, 24],
  ["Zsere0", 5, -82, 10, 28],
  ["Zntrl0", 5, -9, 10, 28],
  ["Cnx3wt", 0, -49, 33, 21],
  ["Zgrnd3", 5, -97, 33, 28],
  ["Zsere3", 5, -97, 33, 28],
  ["Zntrl3", 5, -49, 33, 28],
  ["Iml2ra", 1, -90, 32, 28],
  ["Inrtox", 1, -90, 32, 28],
  ["Iml2ra_trn", 1, -90, 32, 28],
  ["Inrtox_trn", 1, -90, 32, 28],
  ["Iml2ra_neg", 1, -90, 32, 28],
  ["Inrtox_neg", 1, -90, 32, 28],
  ["Imzzer", 5, -90, 32, 28],
  ["Imzgrn", 5, -90, 32, 28],
  ["Ickt1", 3, -14, 11, 0],
  ["Ickt2", 3, -14, 11, 0],
  ["Imbus", 0, -13, 11, 0],
  ["Jmbus", 0, -13, 11, 0],
  ["Kmbus", 0, -13, 11, 0],
  ["Lmbus", 0, -13, 11, 0],
  ["Bmut", 5, -13, 11, 0],
  ["Bi1", 1, -13, 11, 0],
  ["Bi2", 1, -13, 11, 0],
  ["Bk1", 1, -13, 11, 14],
  ["Bk2", 1, -13, 11, 14],
  ["Zflpos", 5, 1, 36, 27],
  ["Zflneg", 5, 1, 36, 27],
  ["Zflzer", 5, 1, 36, 27],
  ["Gbz", 5, -7, 10, 0],
  ["B2sz", 1, -7, 10, 0],
  ["Gbzlin", 5, -8, 10, 0],
  ["Movcur", 1, -7, 10, 28],
  ["Sctypf", 3, -7, 10, 28],
  ["Brknum", 0, -1, 34, 28],
  ["Brbits", 0, -92, 34, 28],
  ["Brint", 1, -92, 34, 28],
  ["Brrate", 1, -92, 34, 28],
  ["Brmomr", 1, -92, 34, 28],
  ["Brprtm", 1, -93, 34, 28],
  ["Brid", 3, -93, 34, 28],
  ["Brnam", 3, -94, 34, 28],
  ["Nctpak", 0, -95, 35, 31],
  ["Nctord", 0, -95, 35, 31],
  ["Ncttblnam", 3, -151, 35, 31],
  ["Ncstbltimorv", 1, -152, 35, 31],
  ["Ncstblipiq", 5, -152, 35, 31],
  ["Mtemp", 4, 1, 35, 31],
  ["Ncmtyp", 0, -5, 53, 31],
  ["Ptemp", 4, 1, 53, 31],
  ["Ncmpos", 0, -5, 54, 31],
  ["Ntemp", 4, 1, 53, 31],
  ["Ncmneg", 0, -5, 55, 31],
  ["Ncmimx", 1, -5, 53, 31],
  ["Ncmvmi", 1, -5, 53, 31],
  ["Ncmvmx", 1, -5, 53, 31],
  ["Oldblvlt", 6, 1, 36, 30],
  ["Ophdre", 1, 0, 15, 20],
  ["Ophdin", 0, 0, 15, 18],
  ["Ophdlo", 4, 0, 15, 20],
  ["Bvmax", 1, -1, 15, 18],
  ["Bvmin", 1, -1, 15, 18],
  ["Bvmxe", 1, -1, 15, 18],
  ["Bvmne", 1, -1, 15, 18],
  ["Lmvtyp", 0, -1, 15, 18],
  ["Rhslv", 1, -1, 15, 18],
  ["Bvar", 0, -1, 15, 18],
  ["Vrnext", 0, -53, 16, 18],
  ["Varid", 3, -89, 16, 26],
  ["Varadd", 1, -53, 16, 18],
  ["Varmax", 1, -53, 16, 18],
  ["Varmin", 1, -53, 16, 18],
  ["Varcst", 1, -53, 16, 18],
  ["Vrcstp", 0, -53, 16, 18],
  ["Varst", 0, -53, 16, 18],
  ["Vrcstb", 0, -53, 16, 18],
  ["Bsldtb", 0, -19, 17, 18],
  ["Ebsltb", 0, -54, 18, 18],
  ["Ldmult", 1, -54, 18, 18],
  ["Ldmaxm", 1, -54, 18, 18],
  ["Ldminm", 1, -54, 18, 18],
  ["Ldratm", 1, -54, 18, 18],
  ["Mxratm", 1, -54, 18, 18],
  ["Mnratm", 1, -54, 18, 18],
  ["Ldcst", 1, -54, 18, 18],
  ["Ldcstp", 0, -54, 18, 18],
  ["Ldtbst", 0, -54, 18, 18],
  ["Ldcstb", 0, -54, 18, 18],
  ["Dispch", 1, -5, 15, 18],
  ["Gentbl", 0, -5, 15, 18],
  ["Epgtb", 0, -55, 19, 18],
  ["Mxpdsp", 1, -55, 19, 18],
  ["Mnpdsp", 1, -55, 19, 18],
  ["Pgncst", 1, -55, 19, 18],
  ["Pgcstp", 0, -55, 19, 18],
  ["Pgnst", 0, -55, 19, 18],
  ["Pgcstb", 0, -55, 19, 18],
  ["Mcnptr", 0, -56, 20, 18],
  ["Rtramp", 1, -56, 20, 18],
  ["Rtcapa", 1, -56, 20, 18],
  ["Rcmac", 0, -57, 21, 18],
  ["Xdsyn", 1, -57, 21, 18],
  ["Ismax", 1, -57, 21, 18],
  ["Rpflg", 1, -57, 21, 18],
  ["Rpfle", 1, -57, 21, 18],
  ["Qmax0", 1, -57, 21, 18],
  ["Rcstat", 0, -57, 21, 18],
  ["Brlin", 0, -58, 22, 18],
  ["Rctmlt", 1, -58, 22, 18],
  ["Mxrctm", 1, -58, 22, 18],
  ["Mnrctm", 1, -58, 22, 18],
  ["Brncst", 1, -58, 22, 18],
  ["Brcstp", 0, -58, 22, 18],
  ["Brnst", 0, -58, 22, 18],
  ["Brcstb", 0, -58, 22, 18],
  ["Tblnum", 0, -59, 23, 18],
  ["Tbltyp", 0, -59, 23, 18],
  ["Tbllbl", 3, -60, 23, 18],
  ["Tblcst", 1, -59, 23, 18],
  ["Numprs", 0, -59, 23, 18],
  ["Tblptr", 0, -59, 23, 18],
  ["Tblprs", 5, -61, 23, 18],
  ["Rtlimt", 1, -70, 15, 18],
  ["Period", 1, -70, 15, 18],
  ["Rsts", 0, -70, 15, 18],
  ["Rsfrst", 0, -70, 15, 18],
  ["Rsnext", 0, -62, 15, 18],
  ["Rsvunt", 0, -62, 15, 18],
  ["Bfllin", 0, -63, 24, 18],
  ["Brflid", 3, -63, 24, 18],
  ["Nmflmx", 1, -63, 24, 18],
  ["Nmflmn", 1, -63, 24, 18],
  ["Emrlmx", 1, -63, 24, 18],
  ["Emflmn", 1, -63, 24, 18],
  ["Flwtyp", 0, -63, 24, 18],
  ["Fllmtp", 0, -63, 24, 18],
  ["Flslv", 1, -63, 24, 18],
  ["Inflid", 0, -64, 25, 18],
  ["Intlbl", 3, -65, 25, 18],
  ["Intfmx", 1, -64, 25, 18],
  ["Intfmn", 1, -64, 25, 18],
  ["Ifltyp", 0, -64, 25, 18],
  ["Ifllmt", 0, -64, 25, 18],
  ["Intfsl", 0, -64, 25, 18],
  ["Intptr", 0, -64, 25, 18],
  ["Intnxt", 0, -66, 25, 18],
  ["Infbrn", 0, -66, 25, 18],
  ["Ceqnid", 0, -67, 26, 18],
  ["Eqnlbl", 3, -68, 26, 18],
  ["Cslkmx", 1, -67, 26, 18],
  ["Cslkmn", 1, -67, 26, 18],
  ["Eqnptr", 0, -67, 26, 18],
  ["Eqnnxt", 0, -69, 26, 18],
  ["Eqntyp", 0, -69, 26, 18],
  ["Eqnseq", 0, -69, 26, 18],
  ["Coeffc", 1, -69, 26, 18],
  ["Dcflmx", 1, -31, 27, 21],
  ["Dcflmn", 1, -31, 27, 21],
  ["Dcvtmx", 1, -31, 27, 21],
  ["Dcvtmn", 1, -31, 27, 21],
  ["Brnominalx", 1, -58, 22, 21],
  ["Orgjcode", 0, -1, 0, 30],
  ["Orgicom", 0, -7, 0, 30],
  ["Orgvscmdc", 0, -128, 0, 30],
  ["Orgvsctyp", 0, -126, 0, 30],
  ["Orgmdc", 0, -31, 0, 30],
  ["Orgdcmode", 0, -33, 0, 30],
  ["Orgfcstat", 0, -43, 0, 30],
  ["Stsnam", 3, -107, 39, 29],
  ["Stsnum", 0, -102, 39, 29],
  ["Stsord", 0, -102, 39, 29],
  ["Instas", 0, -102, 39, 29],
  ["Stslon", 1, -102, 39, 29],
  ["Stslat", 1, -102, 39, 29],
  ["Stsgrd", 1, -102, 39, 29],
  ["Salford", 0, -102, 39, 29],
  ["Sordalf", 0, -102, 39, 29],
  ["Stsbfs", 0, -102, 39, 29],
  ["Stsbnx", 0, -1, 39, 29],
  ["Bussts", 0, -1, 39, 29],
  ["Nodnam", 3, -108, 40, 29],
  ["Nodnum", 0, -103, 40, 29],
  ["Nodbus", 0, -103, 40, 29],
  ["Nodcod", 0, -103, 40, 29],
  ["Nodsta", 0, -103, 40, 29],
  ["Bsndfs", 0, -1, 40, 29],
  ["Bsndnx", 0, -103, 40, 29],
  ["Ndtmfs", 0, -103, 40, 29],
  ["Ndtmnx", 0, -106, 40, 29],
  ["Ndtmtyp", 0, -106, 40, 29],
  ["Ndtmseq", 0, -106, 40, 29],
  ["Brchnf", 0, -7, 40, 29],
  ["Brchnt", 0, -7, 40, 29],
  ["Machtm", 0, -5, 40, 29],
  ["Loadtm", 0, -19, 40, 29],
  ["Shnttm", 0, -83, 40, 29],
  ["Swshtm", 0, -10, 40, 29],
  ["Bvartm", 0, -83, 40, 30],
  ["Indmtm", 0, -90, 40, 30],
  ["Dcrctm", 0, -31, 40, 30],
  ["Dcintm", 0, -31, 40, 30],
  ["Vscdtm", 0, -126, 40, 30],
  ["Facstm", 0, -43, 40, 30],
  ["Facttm", 0, -43, 40, 30],
  ["Ntdctm", 0, -113, 40, 30],
  ["Brknam", 3, -109, 41, 29],
  ["Brktyp", 0, -104, 41, 29],
  ["Brknst", 0, -104, 41, 29],
  ["Brkno", 0, -7, 41, 29],
  ["Brkrsetnum", 0, -104, 41, 31],
  ["Brkckt", 3, -110, 42, 29],
  ["Brkcom", 0, -105, 42, 29],
  ["Ibrkno", 0, -105, 42, 29],
  ["Bkrate", 1, 1, 36, 31],
  ["Brkrac", 1, -105, 42, 29],
  ["Ndsfst", 0, -103, 42, 29],
  ["Ndsnxt", 0, -105, 42, 29],
  ["Ndsto", 0, -105, 42, 29],
  ["Ndfrst", 0, -103, 42, 29],
  ["Ndnext", 0, -110, 42, 29],
  ["Ndto", 0, -110, 42, 29],
  ["Ndnum", 0, -110, 42, 29],
  ["gntrms", 0, -122, 38, 29],
  ["gnstat", 0, -112, 38, 27],
  ["gnownr", 0, -112, 38, 27],
  ["gnnmtr", 0, -112, 38, 27],
  ["gnord", 0, -112, 38, 27],
  ["gnname", 3, -114, 38, 27],
  ["gnmodl", 3, -115, 38, 27],
  ["gnysav", 5, -123, 38, 29],
  ["gndatasize", 0, -127, 38, 27],
];

/** Counts are source integers, logical flags, sizing limits and OPF header integers. */
export function savDimension(code: number, I: number[], M: number[], P: number[]): number {
  switch (code) {
    case -151: return ((I[44]*2**2)+(I[44]*2**2)*2+0);
    case -150: return I[67];
    case -149: return ((I[66]*2**3)+(I[66]*2**3)*4+0);
    case -148: return ((I[66]*2**2)+(I[66]*2**2)*2+0);
    case -147: return I[66];
    case -146: return ((I[65]*2**3)+(I[65]*2**3)*8+0);
    case -145: return ((I[65]*2**2)+(I[65]*2**2)*2+0);
    case -144: return I[65];
    case -143: return ((I[69]*2**3)+(I[69]*2**3)*4+0);
    case -142: return I[69];
    case -141: return 12;
    case -140: return ((I[34]*2**3)+(I[34]*2**3)*4+0);
    case -138: return ((I[68]*2**3)+(I[68]*2**3)*4+0);
    case -137: return ((I[68]*2**2)+(I[68]*2**2)*2+0);
    case -136: return I[68];
    case -135: return 36;
    case -134: return ((I[5]*2**3)+(I[5]*2**3)*4+0);
    case -133: return ((I[2]*2**3)+(I[2]*2**3)*4+0);
    case -132: return ((I[38]*2**3)+(I[38]*2**3)*4+0);
    case -131: return ((I[26]*2**3)+(I[26]*2**3)*4+0);
    case -130: return ((I[31]+I[31])+(I[31]+I[31])*4+0);
    case -129: return ((I[26]*2**2)+(I[26]*2**2)*2+0);
    case -128: return I[31];
    case -127: return 0;
    case -126: return (I[31]+I[31]);
    case -125: return (I[5]+I[5]);
    case -123: return ((I[39]*2**2)+(I[39]*2**2)*8+0);
    case -122: return ((I[39]+I[39])+(I[39]+I[39])*2+0);
    case -121: return (I[39]*2**2);
    case -120: return (I[39]+I[39]);
    case -119: return ((I[2]+I[2])+(I[2]+I[2])*2+0);
    case -118: return ((I[30]*2**3)+(I[30]*2**3)*4+0);
    case -116: return ((M[2]*2**3)+(M[2]*2**3)*2+0);
    case -115: return (I[39]*2**4);
    case -114: return ((I[39]*2**2)+(I[39]*2**2)*2+0);
    case -113: return (M[5]*I[7]);
    case -112: return I[39];
    case -111: return (I[47]+I[47]*2+0);
    case -110: return (I[47]+I[47]);
    case -109: return ((I[48]*2**3)+(I[48]*2**3)*4+0);
    case -108: return ((I[46]*2**3)+(I[46]*2**3)*4+0);
    case -107: return ((I[45]*2**3)+(I[45]*2**3)*4+0);
    case -106: return I[49];
    case -105: return I[47];
    case -104: return I[48];
    case -103: return I[46];
    case -102: return I[45];
    case -100: return 384;
    case -99: return 72;
    case -98: return ((I[3]*2**3)+(I[3]*2**3)*4+0);
    case -97: return (I[30]+I[30]*2+0);
    case -96: return (I[44]+I[44]);
    case -95: return I[44];
    case -94: return ((I[43]*2**2)+(I[43]*2**2)*2+0);
    case -93: return (I[43]+I[43]);
    case -92: return I[43];
    case -91: return (I[38]+I[38]);
    case -90: return I[38];
    case -89: return (P[2]+P[2]);
    case -88: return ((I[7]*2**2)+(I[7]*2**2)*2+0);
    case -87: return ((0+I[7]*8+0)-I[7]);
    case -86: return ((I[29]*2**2)+(I[29]*2**2)*2+0);
    case -85: return I[33];
    case -84: return (I[34]+I[34]);
    case -83: return I[34];
    case -82: return (I[4]+I[4]);
    case -81: return ((I[31]*2**2)+(I[31]*2**2)*2+0);
    case -80: return ((I[36]*2**2)+(I[36]*2**2)*2+0);
    case -79: return ((I[37]*2**2)+(I[37]*2**2)*2+0);
    case -78: return ((I[35]*2**2)+(I[35]*2**2)*2+0);
    case -77: return (((I[7]*M[6])*2**2)+((I[7]*M[6])*2**2)*2+0);
    case -76: return ((I[30]*2**2)+(I[30]*2**2)*2+0);
    case -75: return ((I[4]*2**2)+(I[4]*2**2)*2+0);
    case -74: return ((I[0]*2**2)+(I[0]*2**2)*2+0);
    case -73: return ((I[31]*2**5)-(I[31]+I[31]*1+0));
    case -72: return (I[31]*2**3);
    case -71: return ((I[31]+I[31])+(I[31]+I[31])*2+0);
    case -70: return 15;
    case -69: return P[16];
    case -68: return ((P[15]*2**2)+(P[15]*2**2)*2+0);
    case -67: return P[15];
    case -66: return P[14];
    case -65: return (P[13]*2**5);
    case -64: return P[13];
    case -63: return P[12];
    case -62: return P[11];
    case -61: return P[9];
    case -60: return ((P[8]*2**2)+(P[8]*2**2)*2+0);
    case -59: return P[8];
    case -58: return P[7];
    case -57: return P[6];
    case -56: return P[5];
    case -55: return P[4];
    case -54: return P[3];
    case -53: return P[2];
    case -52: return (I[30]*2**3);
    case -51: return (I[30]*2**2);
    case -50: return (I[30]+I[30]);
    case -49: return I[30];
    case -48: return (I[4]*2**3);
    case -47: return (I[6]*2**2);
    case -46: return ((I[6]*2**2)+(I[6]*2**2)*8+0);
    case -45: return ((I[6]*2**2)+(I[6]*2**2)*2+0);
    case -44: return (0+I[37]*8+8);
    case -43: return I[29];
    case -42: return (M[7]*I[7]);
    case -41: return ((I[7]*M[7])+(I[7]*M[7])*2+0);
    case -40: return ((I[7]*M[7])+(I[7]*M[7]));
    case -39: return ((I[7]*M[6])*2**3);
    case -38: return ((I[7]*M[6])+(I[7]*M[6])*2+0);
    case -37: return ((I[7]*M[6])+(I[7]*M[6]));
    case -36: return ((I[7]*M[5])+(I[7]*M[5])*4+0);
    case -35: return (((I[7]*M[5])*2**4)+(I[7]*M[5]));
    case -34: return ((I[7]+I[7])+(I[7]+I[7])*2+0);
    case -33: return I[7];
    case -32: return (I[6]+I[6]);
    case -31: return I[6];
    case -30: return (I[36]*2**3);
    case -29: return I[36];
    case -28: return I[28];
    case -27: return I[27];
    case -26: return M[2];
    case -25: return (I[37]*2**3);
    case -24: return I[37];
    case -23: return (I[35]*2**3);
    case -22: return I[35];
    case -21: return (I[26]+I[26]*2+0);
    case -20: return (I[26]+I[26]);
    case -19: return I[26];
    case -18: return I[25];
    case -17: return (I[24]+I[24]);
    case -16: return I[24];
    case -15: return I[23];
    case -14: return (I[9]+I[9]);
    case -13: return I[9];
    case -12: return I[8];
    case -11: return (I[5]*2**3);
    case -10: return I[5];
    case -9: return I[4];
    case -8: return (I[3]+I[3]);
    case -7: return I[3];
    case -6: return (I[2]+I[2]);
    case -5: return I[2];
    case -4: return I[1];
    case -3: return (I[0]*2**3);
    case -2: return ((I[0]+I[0])+(I[0]+I[0])*2+0);
    case -1: return I[0];
    default: throw new Error(`SAV_UNSUPPORTED_DIMENSION: ${code}`);
  }
}

export function savPredicate(code: number, I: number[], L: number[], P: number[], M: number[], flag: (name: string) => number): boolean {
  switch (code) {
    case 0: return true;
    case 1: return (I[26]>0);
    case 2: return (I[8]>0);
    case 3: return (I[29]>0);
    case 4: return (I[6]>0);
    case 5: return (I[7]>0);
    case 6: return (I[5]>0);
    case 7: return (I[23]>0);
    case 8: return (I[25]>0);
    case 9: return (L[7]!=0);
    case 10: return (L[0]!=0);
    case 11: return (!(L[0]==0) && (I[9]>0));
    case 12: return (!(L[0]==0) && (I[8]>0));
    case 13: return (!(L[0]==0) && (I[5]>0));
    case 14: return (L[16]!=0);
    case 15: return (L[7]!=0);
    case 16: return (!(L[7]==0) && (P[2]>0));
    case 17: return (!(L[7]==0) && (I[26]>0));
    case 18: return (!(L[7]==0) && (P[3]>0));
    case 19: return (!(L[7]==0) && (P[4]>0));
    case 20: return (!(L[7]==0) && (P[5]>0));
    case 21: return (!(L[7]==0) && (P[6]>0));
    case 22: return (!(L[7]==0) && (P[7]>0));
    case 23: return (!(L[7]==0) && (P[8]>0));
    case 24: return (!(L[7]==0) && (P[12]>0));
    case 25: return (!(L[7]==0) && (P[13]>0));
    case 26: return (!(L[7]==0) && (P[15]>0));
    case 27: return (!(L[7]==0) && (I[6]>0));
    case 28: return (I[31]>0);
    case 29: return (I[34]>0);
    case 30: return (I[33]>0);
    case 31: return (I[38]>0);
    case 32: return (!(L[0]==0) && (I[38]>0));
    case 33: return (!(L[0]==0) && (I[30]>0));
    case 34: return (!(L[0]==0) && (I[43]>0));
    case 35: return (!(L[0]==0) && (I[44]>0));
    // Dispatch target RVA 0xA6EC7 returns without a field: virtual/obsolete entry.
    case 36: return false;
    case 37: return (!(L[7]==0) && !(P[2]<=0));
    case 38: return (I[39]>0);
    case 39: return (I[45]>0);
    case 40: return (I[46]>0);
    case 41: return (I[48]>0);
    case 42: return (I[47]>0);
    case 43: return (M[2]>0);
    case 44: return !(L[16]!=0);
    case 45: return (I[30]>0);
    case 46: return (L[36]!=0);
    // Layout-30 compatibility flag: open initializes RVA 0x1A6CB8 to zero;
    // helper RVA 0xA7370 can modify it only when the layout equals 30.
    case 47: return false;
    case 48: return (I[68]>0);
    case 49: return (I[69]>0);
    case 50: return (I[65]>0);
    case 51: return (I[66]>0);
    case 52: return !(I[67]<=0);
    case 53: return (!(L[0]==0) && (!(I[44]<=0) && (flag("Mtemp")!=0)));
    case 54: return (!(L[0]==0) && (!(I[44]<=0) && (!(flag("Mtemp")==0) && (flag("Ptemp")!=0))));
    case 55: return (!(L[0]==0) && (!(I[44]<=0) && (!(flag("Mtemp")==0) && (flag("Ntemp")!=0))));
    default: throw new Error(`SAV_UNSUPPORTED_PREDICATE: ${code}`);
  }
}
