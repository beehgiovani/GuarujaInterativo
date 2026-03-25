import asyncio
import os
from playwright.async_api import async_playwright

async def generate_pdf():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        html_path = r'C:\Users\bruno\AndroidStudioProjects\guaruja_geo_lab\resume_template_en.html'
        file_url = f'file:///{html_path.replace("\\", "/")}'
        await page.goto(file_url)
        await page.wait_for_load_state('networkidle')
        
        output_dir = r"C:\Users\bruno\Downloads\Curriculo_Novo"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        pdf_path = os.path.join(output_dir, "Resume_Bruno_Pereira_2026_EN.pdf")
        await page.pdf(path=pdf_path, format='A4', print_background=True, margin={'top': '20mm', 'bottom': '20mm', 'left': '20mm', 'right': '20mm'})
        
        await browser.close()
        print(f"PDF generated: {pdf_path}")

if __name__ == "__main__":
    asyncio.run(generate_pdf())
