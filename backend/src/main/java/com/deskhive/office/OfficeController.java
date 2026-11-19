package com.deskhive.office;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.deskhive.office.OfficeDtos.OfficeResponse;
import com.deskhive.user.CurrentUser;

/** The "Where" picker and Home header: every logged-in person may read offices, floors and rules. */
@RestController
@RequestMapping("/api/offices")
public class OfficeController {

    private final OfficeService officeService;

    public OfficeController(OfficeService officeService) {
        this.officeService = officeService;
    }

    @GetMapping
    public List<OfficeResponse> list(CurrentUser actor) {
        return officeService.list();
    }

    @GetMapping("/{id}")
    public OfficeResponse get(CurrentUser actor, @PathVariable Long id) {
        return officeService.get(id);
    }
}
