import flet as ft

# Simulated user database (replace with a real database in production)
users = {
    "renter@example.com": {"password": "renter123", "role": "renter"},
    "rentee@example.com": {"password": "rentee123", "role": "rentee"},
}


# Main App Function
def main(page: ft.Page):
    # Page settings
    page.title = "GPU Rental App"
    page.theme_mode = ft.ThemeMode.DARK
    page.vertical_alignment = ft.MainAxisAlignment.CENTER
    page.horizontal_alignment = ft.CrossAxisAlignment.CENTER
    page.padding = ft.padding.all(20)  # Add consistent padding
    page.bgcolor = ft.colors.GREY_900
    page.window.min_width = 500

    # Define custom colors and styles
    PRIMARY_COLOR = "#3b82f6"  # Brighter blue
    SECONDARY_COLOR = "#1d4ed8"
    CARD_COLOR = "#1e293b"  # Slightly darker background
    TEXT_COLOR = "#f8fafc"  # Brighter white
    ACCENT_COLOR = "#60a5fa"  # Lighter blue for accents
    HOVER_COLOR = ft.colors.with_opacity(0.1, PRIMARY_COLOR)

    # Custom button style with improved aesthetics
    def custom_button_style(bg_color=PRIMARY_COLOR):
        return ft.ButtonStyle(
            bgcolor={
                "": bg_color,
                "hovered": ft.colors.with_opacity(0.85, bg_color),
            },
            color=TEXT_COLOR,
            padding=ft.padding.only(top=12, bottom=12, left=20, right=20),
            animation_duration=200,
            shape=ft.RoundedRectangleBorder(radius=10),
            elevation={"": 0, "hovered": 3},
            shadow_color=ft.colors.with_opacity(0.2, bg_color),
        )

    # State variables
    is_authenticated = False
    user_role = None
    sidebar_expanded = False
    selected_nav_index = 0  # Add this line to track selected navigation item

    # Responsive width for text fields
    field_width = 300 if page.width > 600 else page.width - 40

    # Enhanced TextField styling
    def custom_text_field(label, password=False, width=None):
        return ft.TextField(
            label=label,
            password=password,
            width=width,
            border_radius=8,
            border_color=ft.colors.with_opacity(0.2, ft.colors.WHITE),
            focused_border_color=PRIMARY_COLOR,
            cursor_color=PRIMARY_COLOR,
            label_style=ft.TextStyle(color=ft.colors.with_opacity(0.7, ft.colors.WHITE)),
            text_style=ft.TextStyle(color=ft.colors.WHITE, size=16),
            bgcolor=ft.colors.with_opacity(0.05, ft.colors.WHITE),
        )

    # Login Form Fields
    email_field = custom_text_field("Email", width=field_width)
    password_field = custom_text_field("Password", password=True, width=field_width)
    login_button = ft.ElevatedButton(
        text="Login",
        width=field_width,
        style=ft.ButtonStyle(
            bgcolor=ft.colors.BLUE_800,
            color=ft.colors.WHITE,
            padding=15,
            shape=ft.RoundedRectangleBorder(radius=10),
        ),
    )
    go_to_register_button = ft.TextButton(
        text="Don't have an account? Register here.",
        on_click=lambda e: show_registration_form(),
    )

    # Registration Form Fields
    reg_email_field = ft.TextField(
        label="Email",
        width=field_width,
        border_color=ft.colors.GREY_600,
        cursor_color=ft.colors.WHITE,
        label_style=ft.TextStyle(color=ft.colors.GREY_400),
        text_style=ft.TextStyle(color=ft.colors.WHITE),
    )
    reg_password_field = ft.TextField(
        label="Password",
        password=True,
        width=field_width,
        border_color=ft.colors.GREY_600,
        cursor_color=ft.colors.WHITE,
        label_style=ft.TextStyle(color=ft.colors.GREY_400),
        text_style=ft.TextStyle(color=ft.colors.WHITE),
    )
    reg_role_field = ft.Dropdown(
        label="Role",
        options=[
            ft.dropdown.Option("Renter"),
            ft.dropdown.Option("Rentee"),
        ],
        width=field_width,
        border_color=ft.colors.GREY_600,
        label_style=ft.TextStyle(color=ft.colors.GREY_400),
        text_style=ft.TextStyle(color=ft.colors.WHITE),
    )
    register_button = ft.ElevatedButton(
        text="Register",
        width=field_width,
        style=ft.ButtonStyle(
            bgcolor=ft.colors.BLUE_800,
            color=ft.colors.WHITE,
            padding=15,
            shape=ft.RoundedRectangleBorder(radius=10),
        ),
    )
    go_to_login_button = ft.TextButton(
        text="Already have an account? Login here.",
        on_click=lambda e: show_login_form(),
    )

    # Error Message Display
    error_message = ft.Text(color=ft.colors.RED, visible=False)

    # Navigation Items
    nav_items = [
        {"icon": ft.icons.DASHBOARD, "label": "Dashboard"},
        {"icon": ft.icons.MICROWAVE, "label": "My GPUs"},
        {"icon": ft.icons.DATA_USAGE, "label": "Usage"},
        {"icon": ft.icons.MONEY, "label": "Income"},
    ]

    # Define the dashboard view function
    def get_dashboard_view():
        return ft.Column(
            [
                # Header section
                ft.Container(
                    ft.Column(
                        [
                            ft.Text(
                                "Active Resources",
                                size=24,
                                weight="bold",
                                color=TEXT_COLOR
                            ),
                            ft.Container(
                                content=custom_text_field(
                                    "Search GPUs",
                                    width=None if page.width < 600 else 300
                                ),
                                margin=ft.margin.only(top=10, bottom=5),
                            ),
                        ],
                    ),
                    margin=ft.margin.only(left=16, right=16, top=20, bottom=10),
                ),

                # Cards section
                ft.Container(
                    ft.Row(
                        [
                            dashboard_card(
                                ft.icons.MEMORY,
                                "Active GPUs",
                                "5/10 GPUs in use",
                                manageGPU_button,
                            ),
                            dashboard_card(
                                ft.icons.TIMER,
                                "Usage Time",
                                "324 hours this month",
                                usage_time_button,
                            ),
                            dashboard_card(
                                ft.icons.PAYMENTS,
                                "Current Cost",
                                "Ksh 15 / hour",
                                current_cost_button,
                            ),
                        ],
                        scroll=ft.ScrollMode.AUTO,
                        spacing=16,
                    ),
                    padding=16,
                ),

                # Table section
                ft.Container(
                    ft.Column(
                        [
                            ft.Text(
                                "Active Instances",
                                size=24,
                                color=TEXT_COLOR,
                                weight="bold"
                            ),
                            ft.Container(
                                content=ft.DataTable(
                                    columns=[
                                        ft.DataColumn(ft.Text("GPU", size=16)),
                                        ft.DataColumn(ft.Text("Task", size=16)),
                                        ft.DataColumn(ft.Text("Duration", size=16)),
                                        ft.DataColumn(ft.Text("Status", size=16)),
                                        ft.DataColumn(ft.Text("Price", size=16), numeric=True),
                                    ],
                                    rows=[
                                        ft.DataRow(
                                            cells=[
                                                ft.DataCell(ft.Text("RTX 4090")),
                                                ft.DataCell(ft.Text("ML Training")),
                                                ft.DataCell(ft.Text("8h 23m")),
                                                ft.DataCell(ft.Text("Running")),
                                                ft.DataCell(ft.Text("Ksh15/h")),
                                            ],
                                        ),
                                        ft.DataRow(
                                            cells=[
                                                ft.DataCell(ft.Text("RTX 3080")),
                                                ft.DataCell(ft.Text("Rendering")),
                                                ft.DataCell(ft.Text("2h 43m")),
                                                ft.DataCell(ft.Text("Running")),
                                                ft.DataCell(ft.Text("Ksh8/h")),
                                            ],
                                        ),
                                    ],
                                    border_radius=12,
                                    heading_row_color=ft.colors.with_opacity(0.1, PRIMARY_COLOR),
                                    heading_row_height=56,
                                    data_row_min_height=52,
                                    data_row_color={"hovered": HOVER_COLOR},
                                    column_spacing=40 if page.width >= 600 else 24,
                                    horizontal_lines=ft.border.BorderSide(1, ft.colors.with_opacity(0.1, ft.colors.WHITE)),
                                ),
                                padding=16,
                                border_radius=12,
                                bgcolor=CARD_COLOR,
                            ),
                        ],
                        spacing=16,
                    ),
                    margin=ft.margin.only(left=16, right=16),
                    padding=ft.padding.only(top=16, bottom=16),
                ),
            ],
            scroll=ft.ScrollMode.HIDDEN,
            expand=True,
        )

    # Mobile-specific views
    def mobile_dashboard_view():
        return ft.Column(
            [
                # Mobile Header
                ft.Container(
                    ft.Text(
                        "Dashboard",
                        size=28,
                        weight="bold",
                        color=TEXT_COLOR
                    ),
                    margin=ft.margin.only(left=16, top=20, bottom=16),
                ),

                # Search bar
                ft.Container(
                    content=custom_text_field(
                        "Search GPUs",
                        width=None
                    ),
                    margin=ft.margin.symmetric(horizontal=16),
                ),

                # Stats Cards - Vertical layout for mobile
                ft.Container(
                    ft.Column(
                        [
                            dashboard_card(
                                ft.icons.MEMORY,
                                "Active GPUs",
                                "5/10 GPUs in use",
                                manageGPU_button,
                            ),
                            dashboard_card(
                                ft.icons.TIMER,
                                "Usage Time",
                                "324 hours this month",
                                usage_time_button,
                            ),
                            dashboard_card(
                                ft.icons.PAYMENTS,
                                "Current Cost",
                                "Ksh 15 / hour",
                                current_cost_button,
                            ),
                        ],
                        spacing=16,
                    ),
                    padding=16,
                ),

                # Active Instances Table
                ft.Container(
                    ft.Column(
                        [
                            ft.Text(
                                "Active Instances",
                                size=20,
                                weight="bold",
                                color=TEXT_COLOR
                            ),
                            ft.Container(
                                content=ft.DataTable(
                                    columns=[
                                        ft.DataColumn(ft.Text("GPU", size=14)),
                                        ft.DataColumn(ft.Text("Task", size=14)),
                                        ft.DataColumn(ft.Text("Duration", size=14)),
                                        ft.DataColumn(ft.Text("Price", size=14)),
                                    ],
                                    rows=[
                                        ft.DataRow(
                                            cells=[
                                                ft.DataCell(ft.Text("RTX 4090")),
                                                ft.DataCell(ft.Text("ML Training")),
                                                ft.DataCell(ft.Text("8h 23m")),
                                                ft.DataCell(ft.Text("Ksh15/h")),
                                            ],
                                        ),
                                        ft.DataRow(
                                            cells=[
                                                ft.DataCell(ft.Text("RTX 3080")),
                                                ft.DataCell(ft.Text("Rendering")),
                                                ft.DataCell(ft.Text("2h 43m")),
                                                ft.DataCell(ft.Text("Ksh8/h")),
                                            ],
                                        ),
                                    ],
                                    border_radius=8,
                                    heading_row_color=ft.colors.with_opacity(0.1, PRIMARY_COLOR),
                                    heading_row_height=48,
                                    data_row_min_height=48,
                                    data_row_color={"hovered": HOVER_COLOR},
                                    column_spacing=24,
                                    horizontal_lines=ft.border.BorderSide(1, ft.colors.with_opacity(0.1, ft.colors.WHITE)),
                                ),
                                padding=8,
                                border_radius=8,
                                bgcolor=CARD_COLOR,
                            ),
                        ],
                        spacing=16,
                    ),
                    margin=ft.margin.all(16),
                ),
            ],
            scroll=ft.ScrollMode.HIDDEN,
            expand=True,
        )

    def mobile_gpus_view():
        return ft.Column(
            [
                ft.Container(
                    ft.Text(
                        "My GPUs",
                        size=28,
                        weight="bold",
                        color=TEXT_COLOR
                    ),
                    margin=ft.margin.only(left=16, top=20, bottom=16),
                ),
                ft.Container(
                    ft.Column(
                        [
                            # GPU Card
                            ft.Card(
                                content=ft.Container(
                                    ft.Column(
                                        [
                                            ft.Row(
                                                [
                                                    ft.Icon(ft.icons.MEMORY, color=PRIMARY_COLOR, size=24),
                                                    ft.Text("RTX 4090", size=18, weight="bold", color=TEXT_COLOR),
                                                    ft.Container(
                                                        ft.Text("Active", size=12),
                                                        bgcolor=ft.colors.GREEN_700,
                                                        border_radius=12,
                                                        padding=8,
                                                    ),
                                                ],
                                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                            ),
                                            ft.Divider(height=16, color=ft.colors.with_opacity(0.1, ft.colors.WHITE)),
                                            ft.Row(
                                                [
                                                    ft.Text("Temperature: 65°C"),
                                                    ft.Text("Memory: 18GB/24GB"),
                                                ],
                                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                            ),
                                        ],
                                    ),
                                    padding=16,
                                ),
                            ),
                        ],
                        spacing=16,
                    ),
                    margin=ft.margin.all(16),
                ),
            ],
            scroll=ft.ScrollMode.HIDDEN,
            expand=True,
        )

    def mobile_usage_view():
        return ft.Column(
            [
                ft.Container(
                    ft.Text(
                        "Usage Stats",
                        size=28,
                        weight="bold",
                        color=TEXT_COLOR
                    ),
                    margin=ft.margin.only(left=16, top=20, bottom=16),
                ),
                ft.Container(
                    ft.Column(
                        [
                            # Usage Stats Cards
                            ft.Card(
                                content=ft.Container(
                                    ft.Column(
                                        [
                                            ft.Text("Total Usage Time", size=16, color=ft.colors.GREY_400),
                                            ft.Text("324 hours", size=24, weight="bold", color=TEXT_COLOR),
                                            ft.ProgressBar(value=0.75, bgcolor=ft.colors.with_opacity(0.1, PRIMARY_COLOR), color=PRIMARY_COLOR),
                                        ],
                                    ),
                                    padding=16,
                                ),
                            ),
                            ft.Card(
                                content=ft.Container(
                                    ft.Column(
                                        [
                                            ft.Text("Cost Overview", size=16, color=ft.colors.GREY_400),
                                            ft.Text("Ksh 4,860", size=24, weight="bold", color=TEXT_COLOR),
                                            ft.Text("This month", size=14, color=ft.colors.GREY_400),
                                        ],
                                    ),
                                    padding=16,
                                ),
                            ),
                        ],
                        spacing=16,
                    ),
                    margin=ft.margin.all(16),
                ),
            ],
            scroll=ft.ScrollMode.HIDDEN,
            expand=True,
        )

    def mobile_income_view():
        return ft.Column(
            [
                ft.Container(
                    ft.Text(
                        "Income",
                        size=28,
                        weight="bold",
                        color=TEXT_COLOR
                    ),
                    margin=ft.margin.only(left=16, top=20, bottom=16),
                ),
                ft.Container(
                    ft.Column(
                        [
                            # Income Overview Card
                            ft.Card(
                                content=ft.Container(
                                    ft.Column(
                                        [
                                            ft.Text("Total Earnings", size=16, color=ft.colors.GREY_400),
                                            ft.Text("Ksh 12,450", size=24, weight="bold", color=TEXT_COLOR),
                                            ft.Text("Last 30 days", size=14, color=ft.colors.GREY_400),
                                        ],
                                    ),
                                    padding=16,
                                ),
                            ),
                            # Recent Transactions
                            ft.Card(
                                content=ft.Container(
                                    ft.Column(
                                        [
                                            ft.Text("Recent Transactions", size=16, weight="bold", color=TEXT_COLOR),
                                            ft.ListTile(
                                                leading=ft.Icon(ft.icons.PAYMENT, color=PRIMARY_COLOR),
                                                title=ft.Text("Payment Received"),
                                                subtitle=ft.Text("From: User123"),
                                                trailing=ft.Text("Ksh 1,500"),
                                            ),
                                            ft.ListTile(
                                                leading=ft.Icon(ft.icons.PAYMENT, color=PRIMARY_COLOR),
                                                title=ft.Text("Payment Received"),
                                                subtitle=ft.Text("From: User456"),
                                                trailing=ft.Text("Ksh 2,300"),
                                            ),
                                        ],
                                    ),
                                    padding=16,
                                ),
                            ),
                        ],
                        spacing=16,
                    ),
                    margin=ft.margin.all(16),
                ),
            ],
            scroll=ft.ScrollMode.HIDDEN,
            expand=True,

        )

    # Update the navigation handler to use mobile views
    def on_nav_item_click(e):
        nonlocal selected_nav_index
        if hasattr(e, 'control'):
            selected_nav_index = e.control.data if hasattr(e.control, 'data') else 0
        else:
            selected_nav_index = e

        # Use different views based on screen size
        if page.width >= 600:
            if selected_nav_index == 0:
                main_content = get_dashboard_view()
            elif selected_nav_index == 1:
                main_content = ft.Column([ft.Text("My GPUs Desktop View")])
            elif selected_nav_index == 2:
                main_content = ft.Column([ft.Text("Usage Desktop View")])
            elif selected_nav_index == 3:
                main_content = ft.Column([ft.Text("Income Desktop View")])
            page.clean()
            page.add(ft.Row([side_nav, main_content], expand=True))
        else:
            if selected_nav_index == 0:
                main_content = mobile_dashboard_view()
            elif selected_nav_index == 1:
                main_content = mobile_gpus_view()
            elif selected_nav_index == 2:
                main_content = mobile_usage_view()
            elif selected_nav_index == 3:
                main_content = mobile_income_view()
            page.clean()
            page.add(main_content, bottom_nav)

        page.update()

    def toggle_sidebar(e):
        nonlocal sidebar_expanded
        sidebar_expanded = not sidebar_expanded
        side_nav.width = 250 if sidebar_expanded else 60
        page.update()

    # Button click handlers for navigation
    def handle_manage_gpu_click(e):
        on_nav_item_click(1)  # Navigate to My GPUs (index 1)

    def handle_usage_click(e):
        on_nav_item_click(2)  # Navigate to Usage (index 2)

    def handle_cost_click(e):
        on_nav_item_click(3)  # Navigate to Income (index 3)

    # Update the buttons with click handlers
    manageGPU_button = ft.ElevatedButton(
        text="Manage GPUs",
        style=custom_button_style(),
        icon=ft.icons.SETTINGS,
        icon_color="white",
        on_click=handle_manage_gpu_click,  # Add click handler
    )

    usage_time_button = ft.ElevatedButton(
        text="View Details",
        style=custom_button_style(),
        icon=ft.icons.ANALYTICS,
        icon_color="white",
        on_click=handle_usage_click,  # Add click handler
    )

    current_cost_button = ft.ElevatedButton(
        text="Billing Info",
        style=custom_button_style(),
        icon=ft.icons.PAYMENT,
        icon_color="white",
        on_click=handle_cost_click,  # Add click handler
    )

    side_nav = ft.Container(
        content=ft.Column(
            controls=[
                ft.Container(
                    content=ft.Row(
                        [
                            ft.IconButton(
                                icon=ft.icons.MENU,
                                on_click=toggle_sidebar,
                                icon_color=PRIMARY_COLOR,
                                icon_size=24,
                            ),
                            ft.Text(
                                "CoreShare",
                                color=PRIMARY_COLOR,
                                weight="bold",
                                size=20,
                                visible=sidebar_expanded,
                            ),
                        ],
                        alignment=ft.MainAxisAlignment.START,
                    ),
                    padding=ft.padding.only(bottom=20),
                ),
                *[
                    ft.Container(
                        content=ft.Row(
                            [
                                ft.Icon(
                                    item["icon"],
                                    color=PRIMARY_COLOR,
                                    size=24,
                                ),
                                ft.Text(
                                    item["label"],
                                    color=TEXT_COLOR,
                                    weight="w500",
                                    size=16,
                                    visible=True,  # Always show labels
                                ),
                            ],
                            spacing=15,
                        ),
                        padding=15,
                        border_radius=8,
                        ink=True,  # Add ripple effect
                        on_click=on_nav_item_click,
                        data=i,
                        bgcolor=HOVER_COLOR if i == selected_nav_index else None,
                    )
                    for i, item in enumerate(nav_items)
                ],
            ],
            spacing=5,
        ),
        padding=20,
        bgcolor=CARD_COLOR,
        border_radius=15,
        width=250,  # Always expanded
        animate=ft.animation.Animation(300, "easeOut"),
        shadow=ft.BoxShadow(
            spread_radius=1,
            blur_radius=15,
            color=ft.colors.with_opacity(0.2, ft.colors.BLACK),
            offset=ft.Offset(2, 2),
        ),
        visible=page.width > 600,
    )

    # Bottom Navigation Bar for Mobile
    bottom_nav = ft.NavigationBar(
        destinations=[
            ft.NavigationBarDestination(
                icon=item["icon"],
                label=item["label"],
            )
            for item in nav_items
        ],
        selected_index=selected_nav_index,
        on_change=lambda e: on_nav_item_click(e),
        bgcolor=CARD_COLOR,
        height=65,
        surface_tint_color=PRIMARY_COLOR,
        indicator_color=ft.colors.with_opacity(0.1, PRIMARY_COLOR),
        label_behavior=ft.NavigationBarLabelBehavior.ALWAYS_SHOW,
        visible=page.width < 600,  # Visible only on mobile
    )

    # Enhanced dashboard card styling
    def dashboard_card(icon, title, subtitle, button):
        return ft.Container(
            content=ft.Column(
                controls=[
                    ft.Container(
                        content=ft.Icon(icon, size=32, color=PRIMARY_COLOR),
                        bgcolor=ft.colors.with_opacity(0.1, PRIMARY_COLOR),
                        padding=15,
                        border_radius=12,
                        animate=ft.animation.Animation(300, "easeOut"),
                        ink=True,  # Add ripple effect
                    ),
                    ft.Text(
                        title,
                        color=TEXT_COLOR,
                        size=20,
                        weight="bold",
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Text(
                        subtitle,
                        color=ft.colors.with_opacity(0.8, ft.colors.WHITE),
                        size=14,
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Container(
                        content=button,
                        animate=ft.animation.Animation(200, "easeOut"),
                        margin=ft.margin.only(top=10),
                    ),
                ],
                alignment=ft.MainAxisAlignment.CENTER,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=15,
            ),
            padding=25,
            bgcolor=CARD_COLOR,
            border_radius=15,
            width=300,  # Slightly wider
            height=260,  # Slightly taller
            shadow=ft.BoxShadow(
                spread_radius=0,
                blur_radius=15,
                color=ft.colors.with_opacity(0.15, ft.colors.BLACK),
                offset=ft.Offset(2, 2),
            ),
            animate=ft.animation.Animation(300, "easeOut"),
            gradient=ft.LinearGradient(
                begin=ft.alignment.top_left,
                end=ft.alignment.bottom_right,
                colors=[
                    ft.colors.with_opacity(0.05, PRIMARY_COLOR),
                    "transparent",
                ],
            ),
        )

    # RENTER DASHBOARD VIEW
    renter_dashboard = ft.Column(
        [
            # Header section
            ft.Container(
                ft.Column(
                    [
                        ft.Text(
                            "Active Resources",
                            size=24,  # Larger title following Apple's typography
                            weight="bold",
                            color=TEXT_COLOR
                        ),
                        ft.Container(
                            content=custom_text_field(
                                "Search GPUs",
                                width=None if page.width < 600 else 300
                            ),
                            margin=ft.margin.only(top=10, bottom=5),
                        ),
                    ],
                ),
                margin=ft.margin.only(left=16, right=16, top=20, bottom=10),  # Consistent 16pt margins
            ),

            # Cards section with horizontal scroll on mobile
            ft.Container(
                ft.Row(  # Changed from Column to Row for horizontal layout
                    [
                        dashboard_card(
                            ft.icons.MEMORY,
                            "Active GPUs",
                            "5/10 GPUs in use",
                            manageGPU_button,
                        ),
                        dashboard_card(
                            ft.icons.TIMER,
                            "Usage Time",
                            "324 hours this month",
                            usage_time_button,
                        ),
                        dashboard_card(
                            ft.icons.PAYMENTS,
                            "Current Cost",
                            "Ksh 15 / hour",
                            current_cost_button,
                        ),
                    ],
                    scroll=ft.ScrollMode.AUTO,  # Enable horizontal scrolling
                    spacing=16,
                ),
                padding=16,
            ),

            # Table section with improved mobile view
            ft.Container(
                ft.Column(
                    [
                        ft.Text(
                            "Active Instances",
                            size=24,
                            color=TEXT_COLOR,
                            weight="bold"
                        ),
                        ft.Container(
                            content=ft.DataTable(
                                columns=[
                                    ft.DataColumn(ft.Text("GPU", size=16)),
                                    ft.DataColumn(ft.Text("Task", size=16)),
                                    ft.DataColumn(ft.Text("Duration", size=16)),
                                    ft.DataColumn(ft.Text("Status", size=16)),
                                    ft.DataColumn(ft.Text("Price", size=16), numeric=True),
                                ],
                                rows=[
                                    ft.DataRow(
                                        cells=[
                                            ft.DataCell(ft.Text("RTX 4090")),
                                            ft.DataCell(ft.Text("ML Training")),
                                            ft.DataCell(ft.Text("8h 23m")),
                                            ft.DataCell(ft.Text("Running")),
                                            ft.DataCell(ft.Text("Ksh15/h")),
                                        ],
                                    ),
                                    ft.DataRow(
                                        cells=[
                                            ft.DataCell(ft.Text("RTX 3080")),
                                            ft.DataCell(ft.Text("Rendering")),
                                            ft.DataCell(ft.Text("2h 43m")),
                                            ft.DataCell(ft.Text("Running")),
                                            ft.DataCell(ft.Text("Ksh8/h")),
                                        ],
                                    ),
                                ],
                                border_radius=12,
                                heading_row_color=ft.colors.with_opacity(0.1, PRIMARY_COLOR),
                                heading_row_height=56,
                                data_row_min_height=52,
                                data_row_color={"hovered": HOVER_COLOR},
                                column_spacing=40 if page.width >= 600 else 24,
                                horizontal_lines=ft.border.BorderSide(1, ft.colors.with_opacity(0.1, ft.colors.WHITE)),
                            ),
                            padding=16,
                            border_radius=12,
                            bgcolor=CARD_COLOR,
                        ),
                    ],
                    spacing=16,
                ),
                margin=ft.margin.only(left=16, right=16),
                padding=ft.padding.only(top=16, bottom=16),
            ),

            # Alerts section with improved mobile styling
            ft.Container(
                ft.Card(
                    content=ft.Container(
                        content=ft.Column(
                            [
                                ft.ListTile(
                                    title=ft.Text(
                                        "Recent Alerts",
                                        size=24,
                                        weight="bold"
                                    ),
                                    content_padding=16,
                                ),
                                ft.ListTile(
                                    leading=ft.Icon(
                                        ft.icons.WARNING,
                                        color=ft.colors.AMBER,
                                        size=24
                                    ),
                                    title=ft.Text(
                                        "GPU Temperature Alert",
                                        weight="w500"
                                    ),
                                    subtitle=ft.Text("RTX 4090 running hot"),
                                    dense=True
                                ),
                                ft.ListTile(
                                    leading=ft.Icon(
                                        ft.icons.CHECK_CIRCLE,
                                        color=ft.colors.GREEN,
                                        size=24
                                    ),
                                    title=ft.Text(
                                        "Task Completed",
                                        weight="w500"
                                    ),
                                    subtitle=ft.Text("ML Training finished"),
                                ),
                            ],
                            spacing=0,
                        ),
                        padding=16,
                    ),
                ),
                margin=ft.margin.only(left=16, right=16, bottom=80),  # Extra bottom margin for nav bar
            ),
        ],
        spacing=0,  # Remove spacing between sections
        scroll=ft.ScrollMode.HIDDEN,
        expand=True,
    )

    # RENTEE DASHBOARD VIEW
    rentee_dashboard = ft.Column(
        [
            ft.Text("Welcome, Rentee!", size=30, weight="bold", color=ft.colors.WHITE),
            ft.Text("You can rent GPU power here.", color=ft.colors.GREY_400),
        ],
        alignment=ft.MainAxisAlignment.CENTER,
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
        scroll=ft.ScrollMode.HIDDEN,
        expand=True,
    )

    # Login Function
    def login(e):
        nonlocal is_authenticated, user_role
        email = email_field.value
        password = password_field.value
        if email in users and users[email]["password"] == password:
            is_authenticated = True
            user_role = users[email]["role"]
            error_message.visible = False
            update_ui()
        else:
            error_message.value = "Invalid email or password."
            error_message.visible = True
            page.update()

    # Registration Function
    def register(e):
        email = reg_email_field.value
        password = reg_password_field.value
        role = reg_role_field.value.lower()  # Convert role to lowercase
        if email and password and role:
            if email in users:
                error_message.value = "Email already registered."
                error_message.visible = True
            else:
                users[email] = {"password": password, "role": role}
                error_message.value = "Registration successful! Please login."
                error_message.visible = True
                show_login_form()  # Switch to login form after registration
        else:
            error_message.value = "Please fill all fields."
            error_message.visible = True
        page.update()

    # Show Login Form
    def show_login_form():
        page.clean()
        page.add(
            ft.Column(
                [
                    ft.Text("CoreShare", size=36, weight="bold", color=ft.colors.BLUE),
                    ft.Text("Login", size=30, weight="bold", color=ft.colors.WHITE),
                    email_field,
                    password_field,
                    login_button,
                    go_to_register_button,
                    error_message,
                ],
                alignment=ft.MainAxisAlignment.CENTER,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=20,
            )
        )

    # Show Registration Form
    def show_registration_form():
        page.clean()
        page.add(
            ft.Column(
                [
                    ft.Text("CoreShare", size=36, weight="bold", color=ft.colors.BLUE),
                    ft.Text("Register", size=30, weight="bold", color=ft.colors.WHITE),
                    reg_email_field,
                    reg_password_field,
                    reg_role_field,
                    register_button,
                    go_to_login_button,
                    error_message,
                ],
                alignment=ft.MainAxisAlignment.CENTER,
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=20,
            )
        )

    # Update UI Based on Authentication State
    def update_ui():
        if is_authenticated:
            page.clean()
            main_content = renter_dashboard if user_role == "renter" else rentee_dashboard

            if page.width >= 600:
                # Desktop layout
                page.add(ft.Row([side_nav, main_content], expand=True))
            else:
                # Mobile layout
                page.add(
                    main_content,
                    bottom_nav
                )
        else:
            show_login_form(),



    # Bind Buttons to Functions
    login_button.on_click = login
    register_button.on_click = register

    # Add window resize handler
    def page_resize(e):
        side_nav.visible = page.width >= 600
        bottom_nav.visible = page.width < 600
        update_ui()  # Refresh the layout when resizing

    page.on_resize = page_resize

    # Initial UI Setup
    update_ui()


# Run the App
ft.app(target=main)