import pandas as pd
import re
import string
import os
from rouge_score import rouge_scorer
from tabulate import tabulate

def preprocess_text(text):
    """
    Standard NLP preprocessing untuk evaluasi teks (seperti ROUGE).
    - Case folding (lowercasing)
    - Menghapus tanda baca (punctuation removal)
    - Menghilangkan spasi berlebih
    """
    if not isinstance(text, str):
        return ""
    
    # Lowercasing
    text = text.lower()
    
    # Menghapus punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    
    # Menghapus ekstra spasi putih
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def evaluate_rouge(dataset):
    """
    Fungsi untuk melakukan perhitungan metrik ROUGE pada dataset.
    Mendukung ROUGE-1, ROUGE-2, dan ROUGE-L.
    
    Args:
        dataset (list of dict): Daftar dictionary yang berisi 'question', 'reference_answer', dan 'system_output'.
        
    Returns:
        pd.DataFrame: DataFrame berisi hasil evaluasi level kalimat (individual).
        dict: Hasil evaluasi agregat (corpus-level).
    """
    # Inisialisasi ROUGE Scorer
    # rouge1: unigram overlap, rouge2: bigram overlap, rougeL: Longest Common Subsequence
    scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    
    results = []
    
    for item in dataset:
        question = item['question']
        
        # Preprocessing teks sebelum evaluasi
        ref_ans = preprocess_text(item['reference_answer'])
        sys_out = preprocess_text(item['system_output'])
        
        # Hitung skor ROUGE
        scores = scorer.score(ref_ans, sys_out)
        
        # Simpan metrik lengkap: Precision, Recall, dan F-Measure (F1-Score)
        results.append({
            'Question': question,
            'Reference Answer (Preprocessed)': ref_ans,
            'System Output (Preprocessed)': sys_out,
            'ROUGE-1 Precision': scores['rouge1'].precision,
            'ROUGE-1 Recall': scores['rouge1'].recall,
            'ROUGE-1 F1': scores['rouge1'].fmeasure,
            'ROUGE-2 Precision': scores['rouge2'].precision,
            'ROUGE-2 Recall': scores['rouge2'].recall,
            'ROUGE-2 F1': scores['rouge2'].fmeasure,
            'ROUGE-L Precision': scores['rougeL'].precision,
            'ROUGE-L Recall': scores['rougeL'].recall,
            'ROUGE-L F1': scores['rougeL'].fmeasure,
        })
        
    # Konversi ke Pandas DataFrame agar rapi
    df_results = pd.DataFrame(results)
    
    # Perhitungan agregat (Corpus-Level Evaluation)
    # Rata-rata dari setiap metrik di seluruh dataset
    metrics_cols = [col for col in df_results.columns if 'ROUGE' in col]
    aggregate_results = df_results[metrics_cols].mean().to_dict()
    
    return df_results, aggregate_results

def main():
    print("Memulai evaluasi sistem RAG Chatbot KPedia...\n")
    
    # 1. Dataset Evaluasi (Bisa import dari file CSV jika ada, atau gunakan dummy)
    input_csv = "dataset_evaluasi.csv"
    if os.path.exists(input_csv):
        print(f"Membaca dataset dari {input_csv}...")
        df_input = pd.read_csv(input_csv, sep=';') # Coba separator ; dulu
        if len(df_input.columns) < 3:
            df_input = pd.read_csv(input_csv, sep=',') # Fallback ke koma
        
        # Konversi dataframe ke list of dictionaries yang diharapkan oleh fungsi evaluasi
        dataset = df_input.to_dict('records')
    else:
        print(f"File {input_csv} tidak ditemukan, menggunakan dataset contoh...")
        dataset = [
            {
                "question": "Apa syarat utama untuk mendaftar Kerja Praktik?",
                "reference_answer": "Syarat utama pendaftaran Kerja Praktik adalah mahasiswa telah menempuh minimal 90 SKS dan memiliki IPK minimal 2.0 tanpa nilai E.",
                "system_output": "Untuk mendaftar Kerja Praktik, mahasiswa harus sudah mengambil setidaknya 90 SKS dengan IPK paling rendah 2.0 dan tidak boleh ada nilai E."
            },
            {
                "question": "Berapa lama durasi pelaksanaan Kerja Praktik?",
                "reference_answer": "Pelaksanaan Kerja Praktik dilaksanakan selama minimal 1 bulan atau 4 minggu berturut-turut di instansi perusahaan tempat KP.",
                "system_output": "Kerja Praktik wajib dilaksanakan minimal selama 4 minggu berturut turut di perusahaan."
            },
            {
                "question": "Siapa yang menguji seminar Kerja Praktik?",
                "reference_answer": "Seminar Kerja Praktik diuji oleh satu orang Dosen Penguji dan dihadiri oleh Dosen Pembimbing KP.",
                "system_output": "Seminar KP akan diuji oleh dosen penguji dan dihadiri dosen pembimbing."
            },
            {
                "question": "Bagaimana format penulisan laporan KP?",
                "reference_answer": "Laporan Kerja Praktik ditulis menggunakan font Times New Roman ukuran 12, spasi 1.5, dan margin kiri 4 cm, margin lainnya 3 cm.",
                "system_output": "Laporan KP menggunakan format Times New Roman ukuran 12 spasi 1.5 margin 4 3 3 3."
            }
        ]
    
    # 2, 3, & 4. Jalankan Pipeline: Preprocessing, Hitung Metrik ROUGE, dan Agregasi
    df_individual, aggregate_scores = evaluate_rouge(dataset)
    
    # 5. Visualisasi Hasil Individual (Menggunakan library tabulate agar berbentuk tabel rapi di terminal)
    print("\n" + "="*95)
    print("HASIL EVALUASI INDIVIDUAL (F1-SCORE)")
    print("="*95)
    f1_df = df_individual[['Question', 'ROUGE-1 F1', 'ROUGE-2 F1', 'ROUGE-L F1']]
    print(tabulate(f1_df.round(4), headers='keys', tablefmt='psql', showindex=False))
    
    # 5. Visualisasi Hasil Agregat
    print("\n" + "="*45)
    print("HASIL EVALUASI AGREGAT (CORPUS-LEVEL)")
    print("="*45)
    aggregate_df = pd.DataFrame([aggregate_scores])
    aggregate_transposed = aggregate_df.T.rename(columns={0: "Average Score"}).round(4)
    print(tabulate(aggregate_transposed, headers=['Metric', 'Average Score'], tablefmt='psql'))
    
    # 6. Ekspor ke CSV
    csv_filename = "hasil_evaluasi_rouge.csv"
    df_individual.to_csv(csv_filename, index=False, sep=';')
    print("\n" + "="*95)
    print(f"[SUCCESS] Seluruh hasil metrik individual telah diekspor ke: {csv_filename}")
    print("="*95)

if __name__ == "__main__":
    main()
