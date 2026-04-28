#!/usr/bin/env python3
"""
CMS QHP Landscape PY2026 → Florida Plan Data Extraction
Lakeland Health Insurance - Annual Data Pipeline

Usage:
  1. Download QHP Landscape ZIP from data.healthcare.gov
  2. Run: python extract_cms_data.py individual_market_medical.xlsx
  3. Output: fl_qhp_data.json (deploy to Netlify /data/)

Source: https://data.healthcare.gov/dataset/6fe7fb77-7291-4104-952f-7c7e2c5d0c45
"""
import pandas as pd
import json
import sys
import os

def extract(input_file, output_file="fl_qhp_data.json"):
    print(f"Reading {input_file}...")
    df = pd.read_excel(input_file, header=1)
    fl = df[df['State Code'] == 'FL'].copy()
    print(f"Florida rows: {len(fl)}")

    def clean(val):
        if pd.isna(val): return None
        v = str(val).strip()
        return None if v in ['N/A','Not Applicable','','nan'] else v

    def clean_premium(val):
        if pd.isna(val): return None
        try: return round(float(str(val).replace('$','').replace(',','')), 2)
        except: return None

    plans = {}
    county_plans = {}
    
    for _, row in fl.iterrows():
        pid = clean(row.get('Plan ID (Standard Component)'))
        county = clean(row.get('County Name'))
        if not pid or not county: continue
        
        if county not in county_plans: county_plans[county] = []
        if pid not in county_plans[county]: county_plans[county].append(pid)
        
        premiums = {
            "child014": clean_premium(row.get('Premium Child Age 0-14')),
            "age18": clean_premium(row.get('Premium Child Age 18')),
            "age21": clean_premium(row.get('Premium Adult Individual Age 21')),
            "age27": clean_premium(row.get('Premium Adult Individual Age 27')),
            "age30": clean_premium(row.get('Premium Adult Individual Age 30 ')),
            "age40": clean_premium(row.get('Premium Adult Individual Age 40 ')),
            "age50": clean_premium(row.get('Premium Adult Individual Age 50 ')),
            "age60": clean_premium(row.get('Premium Adult Individual Age 60 ')),
        }
        
        if pid not in plans:
            def benefit_block(suffix):
                return {
                    "medDeductInd": clean(row.get(f'Medical Deductible - Individual - {suffix}')),
                    "medDeductFam": clean(row.get(f'Medical Deductible - Family - {suffix}')),
                    "drugDeductInd": clean(row.get(f'Drug Deductible - Individual - {suffix}')),
                    "drugDeductFam": clean(row.get(f'Drug Deductible - Family - {suffix}')),
                    "medMoopInd": clean(row.get(f'Medical Maximum Out Of Pocket - Individual - {suffix}'))
                              or clean(row.get(f'Medical Maximum Out Of Pocket -individual - {suffix}')),
                    "medMoopFam": clean(row.get(f'Medical Maximum Out Of Pocket - Family - {suffix}'))
                              or clean(row.get(f'Medical Maximum Out Of Pocket - family - {suffix}')),
                    "drugMoopInd": clean(row.get(f'Drug Maximum Out Of Pocket - Individual - {suffix}'))
                               or clean(row.get(f'Drug Maximum Out Of Pocket - individual - {suffix}')),
                    "drugMoopFam": clean(row.get(f'Drug Maximum Out Of Pocket - Family - {suffix}'))
                               or clean(row.get(f'Drug Maximum Out Of Pocket - Family  - {suffix}')),
                    "pcp": clean(row.get(f'Primary Care Physician - {suffix}')),
                    "specialist": clean(row.get(f'Specialist - {suffix}')),
                    "er": clean(row.get(f'Emergency Room - {suffix}')),
                    "inpatient": clean(row.get(f'Inpatient Facility - {suffix}')),
                    "inpatientPhys": clean(row.get(f'Inpatient Physician - {suffix}')),
                    "genericRx": clean(row.get(f'Generic Drugs - {suffix}')),
                    "prefBrandRx": clean(row.get(f'Preferred Brand Drugs - {suffix}')),
                    "nonPrefBrandRx": clean(row.get(f'Non-preferred Brand Drugs - {suffix}')),
                    "specialtyRx": clean(row.get(f'Specialty Drugs - {suffix}')),
                }
            
            plans[pid] = {
                "name": clean(row.get('Plan Marketing Name')),
                "issuer": clean(row.get('Issuer Name')),
                "metal": clean(row.get('Metal Level')),
                "planType": clean(row.get('Plan Type')),
                "adultDental": clean(row.get('Adult Dental ')) not in [None, 'No'],
                "childDental": clean(row.get('Child Dental ')) not in [None, 'No'],
                "standard": benefit_block('Standard'),
                "csr73": benefit_block('73 Percent'),
                "csr87": benefit_block('87 Percent'),
                "csr94": benefit_block('94 Percent'),
                "sbcUrl": clean(row.get('Summary of Benefits URL')),
                "formularyUrl": clean(row.get('Drug Formulary URL')),
                "brochureUrl": clean(row.get('Plan Brochure URL')),
                "premiumsByCounty": {},
            }
        
        plans[pid]["premiumsByCounty"][county] = premiums

    # Remove nulls
    def remove_nulls(obj):
        if isinstance(obj, dict):
            return {k: remove_nulls(v) for k, v in obj.items() if v is not None}
        elif isinstance(obj, list):
            return [remove_nulls(i) for i in obj]
        return obj

    counties = sorted(fl['County Name'].dropna().unique().tolist())
    issuers = sorted(fl['Issuer Name'].dropna().unique().tolist())

    output = remove_nulls({
        "meta": {
            "source": "CMS QHP Landscape PY2026 Individual Medical",
            "state": "FL",
            "totalPlans": len(plans),
            "totalCounties": len(counties),
            "totalIssuers": len(issuers),
        },
        "counties": counties,
        "issuers": issuers,
        "countyPlans": county_plans,
        "plans": plans,
    })

    with open(output_file, 'w') as f:
        json.dump(output, f, separators=(',', ':'))
    
    size_mb = os.path.getsize(output_file) / 1024 / 1024
    print(f"Output: {output_file} ({size_mb:.1f} MB)")
    print(f"Plans: {len(plans)} | Counties: {len(counties)} | Issuers: {len(issuers)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_cms_data.py <input.xlsx> [output.json]")
        sys.exit(1)
    extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "fl_qhp_data.json")
