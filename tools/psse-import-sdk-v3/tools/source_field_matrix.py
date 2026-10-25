"""Explicit source columns whose normalized values enter ModelValidator.

All other columns remain in source residue and are NOT_COMPARABLE. This matrix
measures source-field comparison coverage, not solver-physics completeness.
"""
FIELDS = {
    'caseid': 'sbase basfrq',
    'bus': 'ibus baskv ide area zone owner vm va nvhi nvlo evhi evlo',
    'load': 'ibus loadid stat area zone pl ql ip iq yp yq owner scale intrpt',
    'fixshunt': 'ibus shntid stat gl bl',
    'generator': 'ibus machid pg qg qt qb vs ireg nreg mbase zr zx stat rmpct pt pb wmod wpf',
    'acline': 'ibus jbus ckt rpu xpu bpu gi bi gj bj stat bp met len '+' '.join(f'rate{i}' for i in range(1,13)),
    'transformer': 'ibus jbus kbus ckt stat cod1 cont1 mag1 mag2 r1_2 x1_2 sbase1_2 r2_3 x2_3 sbase2_3 r3_1 x3_1 sbase3_1 '+' '.join(
        f'{field}{w}' for w in (1,2,3) for field in ('windv','nomv','ang','cod','cont','node','rma','rmi','vma','vmi','ntp','tab'))+' '+' '.join(f'wdg{w}rate{i}' for w in (1,2,3) for i in range(1,13)),
    'swshunt': 'ibus shntid stat modsw binit vswhi vswlo swreg '+' '.join(f'{field}{i}' for i in range(1,9) for field in ('s','n','b')),
    'area': 'iarea isw pdes ptol', 'zone': 'izone', 'owner': 'iowner',
    'sub': 'isub lati long srg', 'subnode': 'isub inode ibus stat vm va',
    'subswd': 'isub inode jnode swdid type stat nstat xpu',
}


def matrix(name, source_tables):
    rows=[]
    for table,value in source_tables.items():
        if not isinstance(value,dict) or not value.get('data'):continue
        compared=set(FIELDS.get(table,'').split())
        for field in value.get('fields',[]):
            rows.append(dict(model=name,table=table,field=field,status='NORMALIZED_COMPARED' if field in compared else 'NOT_COMPARABLE_SOURCE_RESIDUE'))
    return rows
