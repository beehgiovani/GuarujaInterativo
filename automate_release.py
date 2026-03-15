import os
import subprocess
import shutil
import zipfile
import sys
import glob

def run_npm_dist():
    print("🚀 Iniciando Build do Electron (npm run dist)...")
    # Run the npm comamand
    try:
        # Shell=True is often needed on Windows for npm
        subprocess.check_call(["npm", "run", "dist"], shell=True)
        print("✅ Build concluído com sucesso!")
    except subprocess.CalledProcessError:
        print("❌ Erro ao executar 'npm run dist'. Verifique o console.")
        sys.exit(1)

def zip_and_move_desktop():
    print("📦 Processando Instalador Desktop...")
    
    # Paths
    dist_dir = "dist"
    target_dir = os.path.join("mapa_interativo", "downloads")
    
    # Ensure target directory exists
    os.makedirs(target_dir, exist_ok=True)
    
    # Find the .exe file (ignoring blockmap, builder-debug, etc)
    # Looking for 'Guaruja GeoMap Setup *.exe'
    exe_files = glob.glob(os.path.join(dist_dir, "*.exe"))
    
    if not exe_files:
        print("❌ Nenhum arquivo .exe encontrado na pasta dist/")
        return

    # Pick the most recent one if multiple (though dist implies clean build usually)
    latest_exe = max(exe_files, key=os.path.getctime)
    exe_name = os.path.basename(latest_exe)
    print(f"   -> Encontrado: {exe_name}")

    # Zip output path
    zip_output_path = os.path.join(target_dir, "Installer_Windows.zip")
    
    print(f"   -> Zipando para: {zip_output_path}")
    try:
        with zipfile.ZipFile(zip_output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(latest_exe, arcname=exe_name)
        print("✅ Desktop Zipado e Movido com Sucesso!")
    except Exception as e:
        print(f"❌ Erro ao zipar arquivo: {e}")

def build_android():
    print("🤖 Iniciando Build Android (Sync + Gradle)...")
    
    # 1. Sync Web Assets to Android Platform
    print("   -> Sincronizando (npx cap sync android)...")
    try:
        subprocess.check_call(["npx", "cap", "sync", "android"], shell=True)
    except subprocess.CalledProcessError:
        print("❌ Erro no 'npx cap sync android'.")
        return False

    # 2. Build APK via Gradle
    print("   -> Compilando APK (gradlew assembleDebug)...")
    
    # Environment Setup for Java
    env = os.environ.copy()
    if "JAVA_HOME" not in env:
        # Try to find Android Studio's JBR
        jbr_path = r"C:\Program Files\Android\Android Studio\jbr"
        if os.path.exists(jbr_path):
            print(f"      ℹ️ Usando JDK do Android Studio: {jbr_path}")
            env["JAVA_HOME"] = jbr_path
            # Also add to PATH
            env["PATH"] = os.path.join(jbr_path, "bin") + os.pathsep + env["PATH"]
        else:
            print("      ⚠️ JAVA_HOME não definido e não encontrei o Android Studio JBR.")

    original_cwd = os.getcwd()
    try:
        os.chdir("android")
        # Use gradlew.bat for Windows
        gradle_cmd = "gradlew.bat" if os.name == 'nt' else "./gradlew"
        
        # Run with modified environment
        subprocess.check_call([gradle_cmd, "assembleDebug"], shell=True, env=env)
        
        print("✅ APK Compilado com Sucesso!")
        return True
    except subprocess.CalledProcessError:
        print("❌ Erro ao compilar APK via Gradle.")
        return False
    finally:
        os.chdir(original_cwd)

def report_mobile_apk():
    print("📱 APK Mobile (Manual)...")
    # Common path for Capacitor Android build
    apk_path = os.path.join("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    
    if os.path.exists(apk_path):
        print(f"   ✅ APK Atualizado e Disponível em:")
        print(f"      {apk_path}")
        print("      (Este arquivo NÃO foi movido para downloads/ para economizar espaço no hosting)")
    else:
        print("⚠️  APK não encontrado mesmo após tentativa de build.")

def main():
    print("==========================================")
    print("   AUTOMAGIC BUILD & ZIP - GUARUJA GEO    ")
    print("==========================================")
    
    # 1. Run Build
    run_npm_dist()
    
    # 2. Zip Desktop
    zip_and_move_desktop()
    
    # 3. Build Mobile (But don't move/zip)
    if build_android():
        report_mobile_apk()
    
    print("==========================================")
    print("🎉 Processo Finalizado! Arquivos prontos em mapa_interativo/downloads/")
    print("👉 Agora rode 'firebase deploy' para publicar.")
    print("==========================================")

if __name__ == "__main__":
    main()
