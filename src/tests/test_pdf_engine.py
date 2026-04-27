import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch, Mock, mock_open

# Ensure project src is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# import the engine
import pdf_engine as pdf_engine


def _write_min_pdf(path: str, *, user_pw: str | None = None) -> None:
    import fitz

    doc = fitz.open()
    doc.new_page()
    if user_pw is not None:
        doc.save(
            path,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=user_pw,
            owner_pw=user_pw,
        )
    else:
        doc.save(path)
    doc.close()


class TestPdfEngine(unittest.TestCase):
    def test_get_num_pages_success(self):
        fake_reader = Mock()
        fake_reader.pages = [1, 2, 3, 4, 5]
        fake_reader.is_encrypted = False
        with patch('PyPDF2.PdfReader', return_value=fake_reader):
            with patch('builtins.open', mock_open(read_data=b'%PDF-1.4')):
                n = pdf_engine.get_num_pages('dummy.pdf')
                self.assertEqual(n, 5)

    def test_get_num_pages_encrypted_raises_friendly_error(self):
        fake_reader = Mock()
        fake_reader.is_encrypted = True
        fake_reader.pages = [1, 2, 3]
        fake_reader.decrypt.return_value = 0
        with patch('PyPDF2.PdfReader', return_value=fake_reader):
            with patch('builtins.open', mock_open(read_data=b'%PDF-1.4')):
                with self.assertRaises(Exception) as cm:
                    pdf_engine.get_num_pages('secret.pdf')
                self.assertIn('şifreli', str(cm.exception).lower())

    def test_get_num_pages_encrypted_with_password_success(self):
        fake_reader = Mock()
        fake_reader.is_encrypted = True
        fake_reader.decrypt.return_value = 1
        fake_reader.pages = [1, 2, 3]
        with patch('PyPDF2.PdfReader', return_value=fake_reader):
            with patch('builtins.open', mock_open(read_data=b'%PDF-1.4')):
                n = pdf_engine.get_num_pages('secret.pdf', password='1234')
                self.assertEqual(n, 3)
                fake_reader.decrypt.assert_called_once_with('1234')

    def test_validate_pdf_password_success(self):
        fake_reader = Mock()
        fake_reader.is_encrypted = True
        fake_reader.decrypt.return_value = True
        with patch('PyPDF2.PdfReader', return_value=fake_reader):
            with patch('builtins.open', mock_open(read_data=b'%PDF-1.4')):
                self.assertTrue(pdf_engine.validate_pdf_password('secret.pdf', '1234'))

    def test_merge_pdfs_missing_file_raises(self):
        with patch('os.path.isfile', side_effect=lambda p: False):
            with self.assertRaises(Exception) as cm:
                pdf_engine.merge_pdfs(['no_such.pdf'], 'out.pdf')
            self.assertIn('Birleştirilecek dosya bulunamadı', str(cm.exception))

    def test_merge_pdfs_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            a = os.path.join(tmp, 'a.pdf')
            b = os.path.join(tmp, 'b.pdf')
            out = os.path.join(tmp, 'out.pdf')
            _write_min_pdf(a)
            _write_min_pdf(b)
            self.assertTrue(pdf_engine.merge_pdfs([a, b], out))
            self.assertTrue(os.path.isfile(out))

    def test_merge_pdfs_encrypted_raises_friendly_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            sec = os.path.join(tmp, 'secret.pdf')
            out = os.path.join(tmp, 'out.pdf')
            _write_min_pdf(sec, user_pw='x')
            with self.assertRaises(Exception) as cm:
                pdf_engine.merge_pdfs([sec], out)
            self.assertIn('şifreli', str(cm.exception).lower())

    def test_merge_pdfs_encrypted_with_password_success(self):
        with tempfile.TemporaryDirectory() as tmp:
            sec = os.path.join(tmp, 'secret.pdf')
            out = os.path.join(tmp, 'out.pdf')
            _write_min_pdf(sec, user_pw='1234')
            self.assertTrue(
                pdf_engine.merge_pdfs([sec], out, passwords={sec: '1234'}),
            )
            self.assertTrue(os.path.isfile(out))

    def test_extract_pages_invalid_page_raises(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp = os.path.join(tmp, 'in.pdf')
            out = os.path.join(tmp, 'out.pdf')
            _write_min_pdf(inp)
            with self.assertRaises(Exception) as cm:
                pdf_engine.extract_pages(inp, [0], out)
            self.assertIn('Geçersiz sayfa numarası', str(cm.exception))

    def test_extract_pages_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            inp = os.path.join(tmpdir, 'in.pdf')
            out_path = os.path.join(tmpdir, 'out.pdf')
            import fitz

            d = fitz.open()
            d.new_page()
            d.new_page()
            d.new_page()
            d.save(inp)
            d.close()
            self.assertTrue(pdf_engine.extract_pages(inp, [1, 3], out_path))
            self.assertTrue(os.path.isfile(out_path))

    def test_extract_pages_encrypted_with_password_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            inp = os.path.join(tmpdir, 'in.pdf')
            out_path = os.path.join(tmpdir, 'out.pdf')
            _write_min_pdf(inp, user_pw='1234')
            self.assertTrue(pdf_engine.extract_pages(inp, [1], out_path, password='1234'))
            self.assertTrue(os.path.isfile(out_path))

    def test_extract_pages_separate_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            inp = os.path.join(tmpdir, 'in.pdf')
            import fitz

            d = fitz.open()
            d.new_page()
            d.new_page()
            d.new_page()
            d.save(inp)
            d.close()
            paths = pdf_engine.extract_pages_separate(inp, [1, 2], tmpdir)
            self.assertEqual(len(paths), 2)
            for p in paths:
                self.assertTrue(p.endswith('.pdf'))

    def test_word_to_pdf_unsupported_platform(self):
        with patch.object(sys, 'platform', 'linux'):
            with self.assertRaises(Exception) as cm:
                pdf_engine.word_to_pdf('/x/a.docx', '/x/a.pdf')
            self.assertIn('Windows', str(cm.exception))

    def test_word_to_pdf_success_with_fake_docx2pdf(self):
        def fake_convert(src, dst):
            with open(dst, 'wb') as f:
                f.write(b'%PDF-1.4\n')

        fake_mod = types.SimpleNamespace(convert=fake_convert)
        with patch.dict(sys.modules, {'docx2pdf': fake_mod}):
            with patch.object(sys, 'platform', 'win32'):
                with tempfile.TemporaryDirectory() as tmp:
                    docx = os.path.join(tmp, 't.docx')
                    pdf = os.path.join(tmp, 't.pdf')
                    open(docx, 'wb').close()
                    self.assertTrue(pdf_engine.word_to_pdf(docx, pdf))
                    self.assertTrue(os.path.isfile(pdf))


if __name__ == '__main__':
    unittest.main()
