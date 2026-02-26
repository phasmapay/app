package app.phasmapay

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log

class HceService : HostApduService() {

    companion object {
        private const val TAG = "HceService"

        // NDEF Tag Application AID
        private val NDEF_AID = byteArrayOf(
            0xD2.toByte(), 0x76, 0x00, 0x00, 0x85.toByte(), 0x01, 0x01
        )

        // File IDs
        private val CC_FILE_ID = byteArrayOf(0xE1.toByte(), 0x03)
        private val NDEF_FILE_ID = byteArrayOf(0xE1.toByte(), 0x04)

        // Status words
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())

        // State
        @Volatile
        var ndefMessage: ByteArray? = null
        @Volatile
        var isActive: Boolean = false

        fun setPaymentUrl(url: String) {
            // Build NDEF message: URI record with the Solana Pay URL
            val uriBytes = url.toByteArray(Charsets.UTF_8)

            // NDEF URI record: TNF=0x01, type="U", payload = 0x00 (no prefix) + uri
            val payload = ByteArray(uriBytes.size + 1)
            payload[0] = 0x00 // No URI prefix abbreviation
            System.arraycopy(uriBytes, 0, payload, 1, uriBytes.size)

            val typeField = byteArrayOf(0x55) // "U"

            // Record header: MB=1, ME=1, SR=1, TNF=1 => 0xD1
            val recordHeader = 0xD1.toByte()

            // Full NDEF record
            val record = byteArrayOf(
                recordHeader,
                typeField.size.toByte(),
                payload.size.toByte()
            ) + typeField + payload

            // Wrap in NDEF message with 2-byte length prefix (for Type 4 Tag READ BINARY)
            val lenHigh = (record.size shr 8).toByte()
            val lenLow = (record.size and 0xFF).toByte()
            ndefMessage = byteArrayOf(lenHigh, lenLow) + record

            isActive = true
            Log.d(TAG, "HCE payment set: ${url} (${ndefMessage!!.size} bytes)")
        }

        fun clear() {
            ndefMessage = null
            isActive = false
            Log.d(TAG, "HCE cleared")
        }
    }

    private var selectedFile: ByteArray? = null

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        if (commandApdu.size < 4) return SW_NOT_FOUND

        val ins = commandApdu[1]
        val p1 = commandApdu[2]
        val p2 = commandApdu[3]

        return when {
            // SELECT command (INS = 0xA4)
            ins == 0xA4.toByte() -> handleSelect(commandApdu)
            // READ BINARY (INS = 0xB0)
            ins == 0xB0.toByte() -> handleReadBinary(p1, p2, commandApdu)
            else -> SW_NOT_FOUND
        }
    }

    private fun handleSelect(apdu: ByteArray): ByteArray {
        if (apdu.size < 5) return SW_NOT_FOUND
        val lc = apdu[4].toInt() and 0xFF
        if (apdu.size < 5 + lc) return SW_NOT_FOUND
        val data = apdu.sliceArray(5 until 5 + lc)

        return when {
            // SELECT NDEF Application by AID
            data.contentEquals(NDEF_AID) -> {
                Log.d(TAG, "SELECT NDEF App")
                SW_OK
            }
            // SELECT CC file
            data.contentEquals(CC_FILE_ID) -> {
                Log.d(TAG, "SELECT CC file")
                selectedFile = buildCcFile()
                SW_OK
            }
            // SELECT NDEF file
            data.contentEquals(NDEF_FILE_ID) -> {
                Log.d(TAG, "SELECT NDEF file")
                selectedFile = ndefMessage ?: byteArrayOf(0x00, 0x00)
                SW_OK
            }
            else -> SW_NOT_FOUND
        }
    }

    private fun handleReadBinary(p1: Byte, p2: Byte, apdu: ByteArray): ByteArray {
        val file = selectedFile ?: return SW_NOT_FOUND
        val offset = ((p1.toInt() and 0xFF) shl 8) or (p2.toInt() and 0xFF)
        val le = if (apdu.size > 4) apdu.last().toInt() and 0xFF else file.size

        if (offset >= file.size) return SW_NOT_FOUND

        val end = minOf(offset + le, file.size)
        val chunk = file.sliceArray(offset until end)
        Log.d(TAG, "READ BINARY offset=$offset len=${chunk.size}")
        return chunk + SW_OK
    }

    private fun buildCcFile(): ByteArray {
        val ndefLen = ndefMessage?.size ?: 0
        // Capability Container (15 bytes)
        return byteArrayOf(
            0x00, 0x0F,                         // CC length = 15
            0x20,                               // Mapping version 2.0
            0x00, 0x3B,                         // Max R-APDU = 59
            0x00, 0x34,                         // Max C-APDU = 52
            // NDEF File Control TLV
            0x04, 0x06,                         // T=4, L=6
            0xE1.toByte(), 0x04,                // NDEF file ID
            ((ndefLen shr 8) and 0xFF).toByte(),
            (ndefLen and 0xFF).toByte(),         // Max NDEF size
            0x00,                               // Read access: no security
            0xFF.toByte()                       // Write access: denied
        )
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "Deactivated: $reason")
        selectedFile = null
    }
}
